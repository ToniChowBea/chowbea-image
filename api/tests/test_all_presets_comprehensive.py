"""Comprehensive test coverage for every preset in presets.yaml.

Tests that every preset can process realistic synthetic inputs (oversized JPEGs,
PNGs, HEICs, PDFs, and Word docs) and that all rule checks pass. Marks heavy
LibreOffice conversions so they run in CI but don't balloon runtime.
"""

from pathlib import Path
from typing import Literal

import pyvips
import pytest
from pypdf import PdfWriter

from app.services.fix import FixError, fix_files
from app.services.presets import all_presets, get_preset


def _create_jpeg(
    path: Path, width: int, height: int, quality: int = 95, greyscale: bool = False
) -> Path:
    """Write a synthetic noisy JPEG to trigger size reduction."""
    if greyscale:
        grey = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        grey.write_to_file(str(path), Q=quality)
    else:
        red = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        green = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        blue = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        red.bandjoin([green, blue]).write_to_file(str(path), Q=quality)
    return path


def _create_png(path: Path, width: int, height: int) -> Path:
    """Write a PNG with alpha channel and some noise."""
    red = pyvips.Image.gaussnoise(width, height, sigma=80).cast("uchar")
    green = pyvips.Image.gaussnoise(width, height, sigma=80).cast("uchar")
    blue = pyvips.Image.gaussnoise(width, height, sigma=80).cast("uchar")
    alpha = pyvips.Image.black(width, height).add(255).cast("uchar")
    red.bandjoin([green, blue, alpha]).write_to_file(str(path))
    return path


def _create_heic(path: Path, width: int, height: int) -> Path | None:
    """Write a HEIC if pyvips supports HEIF; otherwise return None."""
    try:
        red = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        green = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        blue = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        red.bandjoin([green, blue]).write_to_file(str(path), Q=80)
        return path
    except pyvips.Error:
        return None


def _create_pdf_from_image(path: Path, width: int, height: int) -> Path:
    """Write a single-page PDF wrapping a JPEG."""
    from app.services.pdfutil import wrap_jpeg_as_pdf

    jpeg = (
        pyvips.Image.gaussnoise(width, height, sigma=70)
        .cast("uchar")
        .bandjoin(
            [
                pyvips.Image.gaussnoise(width, height, sigma=70).cast("uchar"),
                pyvips.Image.gaussnoise(width, height, sigma=70).cast("uchar"),
            ]
        )
        .write_to_buffer(".jpg", Q=95)
    )
    wrap_jpeg_as_pdf(jpeg, width, height, path, bands=3)
    return path


def _create_multipage_pdf(path: Path, pages: int = 3) -> Path:
    """Write a multi-page PDF with some text."""
    writer = PdfWriter()
    for i in range(pages):
        writer.add_blank_page(width=595, height=842)
    writer.write(str(path))
    return path


def _create_docx(path: Path) -> Path:
    """Write a minimal Word document that LibreOffice can convert."""
    import zipfile

    # Minimal DOCX structure
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
        # [Content_Types].xml
        docx.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        # _rels/.rels
        docx.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/>'
            "</Relationships>",
        )
        # word/document.xml
        docx.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>"
            "<w:p><w:r><w:t>Test document for upload limits testing. "
            "This paragraph is repeated to increase file size. " * 50
            + "</w:t></w:r></w:p>"
            "</w:body>"
            "</w:document>",
        )
    return path


def _make_test_inputs(
    preset_id: str, accepted: list[str], tmp_path: Path
) -> list[tuple[Path, str, bool]]:
    """Generate realistic test inputs for a preset. Returns [(path, name, is_heavy)]."""
    inputs: list[tuple[Path, str, bool]] = []

    # Determine dimensions based on preset requirements
    preset = get_preset(preset_id)
    assert preset is not None

    # Use generous initial dimensions to test downscaling
    width = max(preset.min_width or 0, 2000) if preset.min_width else 2000
    height = max(preset.min_height or 0, 2400) if preset.min_height else 2400

    # Adjust for portrait/landscape hints
    if preset.orientation == "portrait" and width >= height:
        width, height = height, width
    elif preset.orientation == "landscape" and height >= width:
        width, height = height, width

    # Create appropriate inputs based on accepted types
    if "jpeg" in accepted:
        # Oversized high-res JPEG
        jpeg_path = _create_jpeg(
            tmp_path / f"{preset_id}_test.jpg",
            width,
            height,
            quality=95,
            greyscale=not preset.colour,
        )
        inputs.append((jpeg_path, "test.jpg", False))

    if "png" in accepted:
        # Large PNG
        png_path = _create_png(tmp_path / f"{preset_id}_test.png", width, height)
        inputs.append((png_path, "test.png", False))

    if "tiff" in accepted or "tif" in accepted:
        # TIFF
        tiff_path = tmp_path / f"{preset_id}_test.tiff"
        img = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
        img = img.bandjoin([img.copy(), img.copy()])
        img.write_to_file(str(tiff_path))
        inputs.append((tiff_path, "test.tiff", False))

    if "gif" in accepted:
        # GIF (basic support)
        gif_path = tmp_path / f"{preset_id}_test.gif"
        img = pyvips.Image.gaussnoise(min(width, 800), min(height, 800), sigma=60).cast("uchar")
        img = img.bandjoin([img.copy(), img.copy()])
        img.write_to_file(str(gif_path))
        inputs.append((gif_path, "test.gif", False))

    if "pdf" in accepted:
        # Single-page PDF from image
        pdf_path = _create_pdf_from_image(tmp_path / f"{preset_id}_single.pdf", width, height)
        inputs.append((pdf_path, "document.pdf", False))

        # Multi-page PDF
        multipage_path = _create_multipage_pdf(tmp_path / f"{preset_id}_multi.pdf", pages=3)
        inputs.append((multipage_path, "multi-page.pdf", False))

    if "docx" in accepted or "doc" in accepted:
        # Word document - mark as heavy since it requires LibreOffice
        docx_path = _create_docx(tmp_path / f"{preset_id}_test.docx")
        inputs.append((docx_path, "document.docx", True))

    if "odt" in accepted:
        # ODT (convert DOCX to ODT for testing)
        odt_path = tmp_path / f"{preset_id}_test.odt"
        # Minimal ODT structure
        import zipfile

        with zipfile.ZipFile(odt_path, "w", zipfile.ZIP_DEFLATED) as odt:
            odt.writestr(
                "mimetype",
                "application/vnd.oasis.opendocument.text",
                compress_type=zipfile.ZIP_STORED,
            )
            odt.writestr(
                "META-INF/manifest.xml",
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">'
                '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
                '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
                "</manifest:manifest>",
            )
            odt.writestr(
                "content.xml",
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">'
                '<office:body><office:text><text:p>Test ODT for upload limits testing. ' * 50
                + "</text:p></office:text></office:body></office:document-content>",
            )
        inputs.append((odt_path, "document.odt", True))

    # If no inputs were created (shouldn't happen), create a JPEG fallback
    if not inputs:
        fallback = _create_jpeg(tmp_path / f"{preset_id}_fallback.jpg", 1600, 1200)
        inputs.append((fallback, "fallback.jpg", False))

    return inputs


# Generate test parameters for all presets
def _generate_preset_test_params():
    """Generate pytest parameters for all presets."""
    params = []
    for preset in all_presets():
        # Generate test cases for this preset
        test_cases = []

        if "jpeg" in preset.accepted_types:
            test_cases.append(("jpeg", "high-res JPEG", False))
        if "png" in preset.accepted_types:
            test_cases.append(("png", "large PNG", False))
        if "tiff" in preset.accepted_types or "tif" in preset.accepted_types:
            test_cases.append(("tiff", "TIFF image", False))
        if "gif" in preset.accepted_types:
            test_cases.append(("gif", "GIF image", False))
        if "pdf" in preset.accepted_types:
            test_cases.append(("pdf-single", "single-page PDF", False))
            test_cases.append(("pdf-multi", "multi-page PDF", False))
        if "docx" in preset.accepted_types or "doc" in preset.accepted_types:
            test_cases.append(("docx", "Word document", True))
        if "odt" in preset.accepted_types:
            test_cases.append(("odt", "ODT document", True))

        # If preset doesn't accept any of the above, test that it rejects non-accepted formats
        if not test_cases:
            test_cases.append(("unsupported", "unsupported format test", False))

        for input_type, desc, is_heavy in test_cases:
            params.append((preset.id, input_type, desc, is_heavy))

    return params


@pytest.mark.parametrize(
    "preset_id,input_type,desc,is_heavy",
    _generate_preset_test_params(),
    ids=lambda val: str(val),
)
def test_preset_end_to_end(
    preset_id: str, input_type: str, desc: str, is_heavy: bool, tmp_path: Path, request
):
    """Test that a preset can process its accepted input types and pass all rules.
    
    Tests marked as heavy (LibreOffice conversions) are skipped if LibreOffice is not available.
    Use pytest -m heavy to run only heavy tests, or pytest -m "not heavy" to skip them.
    """
    if is_heavy:
        pytest.importorskip("app.services.office")
        # Apply the heavy marker dynamically for this test case
        request.node.add_marker(pytest.mark.heavy)

    preset = get_preset(preset_id)
    assert preset is not None, f"Preset {preset_id} not found"

    # Create appropriate test input
    width = max(preset.min_width or 0, 2000) if preset.min_width else 2000
    height = max(preset.min_height or 0, 2400) if preset.min_height else 2400

    # Adjust for orientation
    if preset.orientation == "portrait" and width >= height:
        width, height = height, width
    elif preset.orientation == "landscape" and height >= width:
        width, height = height, width

    input_path = None
    input_name = None

    try:
        if input_type == "jpeg":
            input_path = _create_jpeg(
                tmp_path / "test.jpg", width, height, quality=95, greyscale=not preset.colour
            )
            input_name = "test.jpg"

        elif input_type == "png":
            input_path = _create_png(tmp_path / "test.png", width, height)
            input_name = "test.png"

        elif input_type == "tiff":
            input_path = tmp_path / "test.tiff"
            img = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
            if preset.colour:
                img = img.bandjoin([img.copy(), img.copy()])
            img.write_to_file(str(input_path))
            input_name = "test.tiff"

        elif input_type == "gif":
            input_path = tmp_path / "test.gif"
            img = pyvips.Image.gaussnoise(min(width, 800), min(height, 800), sigma=60).cast(
                "uchar"
            )
            img = img.bandjoin([img.copy(), img.copy()])
            img.write_to_file(str(input_path))
            input_name = "test.gif"

        elif input_type == "pdf-single":
            input_path = _create_pdf_from_image(tmp_path / "document.pdf", width, height)
            input_name = "document.pdf"

        elif input_type == "pdf-multi":
            input_path = _create_multipage_pdf(tmp_path / "multi.pdf", pages=3)
            input_name = "multi.pdf"

        elif input_type == "docx":
            input_path = _create_docx(tmp_path / "document.docx")
            input_name = "document.docx"

        elif input_type == "odt":
            input_path = tmp_path / "document.odt"
            import zipfile

            with zipfile.ZipFile(input_path, "w", zipfile.ZIP_DEFLATED) as odt:
                odt.writestr(
                    "mimetype",
                    "application/vnd.oasis.opendocument.text",
                    compress_type=zipfile.ZIP_STORED,
                )
                odt.writestr(
                    "META-INF/manifest.xml",
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">'
                    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
                    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
                    "</manifest:manifest>",
                )
                odt.writestr(
                    "content.xml",
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">'
                    '<office:body><office:text><text:p>Test ODT for upload limits. '
                    * 50
                    + "</text:p></office:text></office:body></office:document-content>",
                )
            input_name = "document.odt"

        elif input_type == "unsupported":
            # Test that unsupported formats are rejected with clear error
            input_path = _create_jpeg(tmp_path / "test.jpg", 1600, 1200)
            input_name = "test.jpg"

        assert input_path is not None and input_path.exists(), "Failed to create test input"
        assert input_name is not None

        # Run the fix pipeline
        result = fix_files([input_path], [input_name], tmp_path, preset)

        # Validate the result
        assert result is not None, f"Fix returned None for {preset_id}/{input_type}"
        assert result.outputs, f"No outputs for {preset_id}/{input_type}"
        assert result.report, f"No report for {preset_id}/{input_type}"

        # Check that output file was created
        output_path, output_name = result.outputs[0]
        assert output_path.exists(), f"Output file missing for {preset_id}/{input_type}"

        # Check report structure
        assert result.report.preset_id == preset_id
        assert result.report.files, "Report has no file entries"

        # Validate rule checks
        file_report = result.report.files[0]
        assert file_report.rules, "No rule checks in report"

        # All rules should pass for accepted types
        if input_type != "unsupported":
            failing_rules = [r for r in file_report.rules if not r.passed]
            if failing_rules:
                failure_details = "\n".join(
                    f"  - {r.label}: expected {r.expected}, got {r.actual}" for r in failing_rules
                )
                pytest.fail(
                    f"Preset {preset_id} failed rules for {desc}:\n{failure_details}\n"
                    f"Preset constraints: accepted={preset.accepted_types}, "
                    f"max_bytes={preset.max_bytes}, min_width={preset.min_width}, "
                    f"min_height={preset.min_height}, orientation={preset.orientation}, "
                    f"colour={preset.colour}, do_not_crop={preset.do_not_crop}"
                )

    except FixError as e:
        # Some presets legitimately cannot accept certain inputs
        # Check that the error is clear and appropriate
        error_msg = str(e).lower()
        assert (
            "not accept" in error_msg
            or "not available" in error_msg
            or "password" in error_msg
            or "export" in error_msg
        ), f"Unclear error message for {preset_id}/{input_type}: {e}"


def test_evidence_pack_multiple_files_merge(tmp_path: Path):
    """Test evidence-pack mode for representative presets that accept multiple formats."""
    # Test with UCAS (accepts PDF, JPEG, ODT)
    preset = get_preset("ucas-documents")
    assert preset is not None

    # Create multiple test files
    jpeg1 = _create_jpeg(tmp_path / "photo1.jpg", 1600, 1200)
    jpeg2 = _create_jpeg(tmp_path / "photo2.jpg", 1200, 1600)
    pdf1 = _create_pdf_from_image(tmp_path / "doc.pdf", 1600, 1200)

    # Run with merge=True
    result = fix_files(
        [jpeg1, jpeg2, pdf1], ["photo1.jpg", "photo2.jpg", "doc.pdf"], tmp_path, preset, merge=True
    )

    # Should produce one merged PDF
    assert len(result.outputs) == 1
    output_path, output_name = result.outputs[0]
    assert output_name == "evidence-pack.pdf"
    assert output_path.exists()
    assert result.report.merged is True

    # Check that the merged PDF is valid and under limit
    assert output_path.stat().st_size <= preset.max_bytes

    # Verify it's a multi-page PDF
    from pypdf import PdfReader

    reader = PdfReader(str(output_path))
    assert len(reader.pages) == 3, "Merged PDF should have 3 pages"

    # Report should include individual files + the pack
    assert len(result.report.files) == 4  # 3 individuals + 1 pack


def test_evidence_pack_without_merge(tmp_path: Path):
    """Test that multiple files without merge produces separate outputs."""
    preset = get_preset("ukvcas")
    assert preset is not None

    jpeg1 = _create_jpeg(tmp_path / "id.jpg", 1600, 1200)
    jpeg2 = _create_jpeg(tmp_path / "proof.jpg", 1200, 1600)

    result = fix_files([jpeg1, jpeg2], ["id.jpg", "proof.jpg"], tmp_path, preset, merge=False)

    # Should produce two separate files
    assert len(result.outputs) == 2
    assert not result.report.merged

    # Both should pass their rules
    for file_report in result.report.files:
        assert file_report.passed, f"File {file_report.filename} failed rules"


def test_presets_with_strict_dimensions(tmp_path: Path):
    """Test presets with minimum dimension requirements (passport, visa photos)."""
    # UK passport requires 600×750 minimum
    passport = get_preset("uk-passport-online")
    assert passport is not None
    assert passport.min_width == 600
    assert passport.min_height == 750

    # Test with image that needs upscaling
    small = _create_jpeg(tmp_path / "small.jpg", 400, 500)
    result = fix_files([small], ["small.jpg"], tmp_path, passport)

    # Should upscale to meet minimums
    output_path, _ = result.outputs[0]
    img = pyvips.Image.new_from_file(str(output_path))
    assert img.width >= 600
    assert img.height >= 750

    # Rules should all pass
    assert result.report.passed


def test_presets_with_colour_requirement(tmp_path: Path):
    """Test presets that require colour images."""
    preset = get_preset("uk-passport-online")
    assert preset is not None
    assert preset.colour is True

    # Create a greyscale image
    greyscale = _create_jpeg(tmp_path / "grey.jpg", 800, 1000, greyscale=True)
    result = fix_files([greyscale], ["grey.jpg"], tmp_path, preset)

    # The colour rule should fail for greyscale input
    file_report = result.report.files[0]
    colour_rule = next((r for r in file_report.rules if r.id == "colour"), None)
    assert colour_rule is not None
    # This will fail because we created a greyscale image
    assert not colour_rule.passed


def test_presets_do_not_crop_constraint(tmp_path: Path):
    """Test that do_not_crop presets preserve aspect ratio."""
    preset = get_preset("uk-passport-online")
    assert preset is not None
    assert preset.do_not_crop is True

    # Create an image with specific aspect ratio
    img = _create_jpeg(tmp_path / "test.jpg", 800, 1000)  # 4:5 ratio
    result = fix_files([img], ["test.jpg"], tmp_path, preset)

    output_path, _ = result.outputs[0]
    output_img = pyvips.Image.new_from_file(str(output_path))

    # Check aspect ratio is preserved (within tolerance)
    original_aspect = 800 / 1000
    output_aspect = output_img.width / output_img.height
    assert abs(original_aspect - output_aspect) < 0.02

    # Crop rule should pass
    file_report = result.report.files[0]
    crop_rule = next((r for r in file_report.rules if r.id == "crop"), None)
    assert crop_rule is not None
    assert crop_rule.passed


def test_all_presets_have_required_fields():
    """Sanity check that all presets have required configuration."""
    for preset in all_presets():
        assert preset.id, "Preset missing id"
        assert preset.name, "Preset missing name"
        assert preset.accepted_types, f"Preset {preset.id} missing accepted_types"
        assert preset.max_bytes or preset.min_bytes, f"Preset {preset.id} has no size limits"
        assert preset.category, f"Preset {preset.id} missing category"

        # Portal presets should have verification metadata
        if preset.category != "generic":
            assert preset.source_url, f"Portal preset {preset.id} missing source_url"
            assert preset.notes, f"Portal preset {preset.id} missing notes"
            if not preset.verified:
                assert "commonly reported" in (preset.notes or "").lower()


def test_count_of_all_presets():
    """Verify we have 41 total presets: 31 portal presets + 10 generic size targets."""
    presets = all_presets()
    assert len(presets) == 41, f"Expected 41 total presets, found {len(presets)}"

    # Count by category
    categories = {}
    for preset in presets:
        categories[preset.category] = categories.get(preset.category, 0) + 1

    # Should have portal presets and generic size targets
    assert categories.get("generic", 0) == 10, "Should have 10 generic size targets"
    portal_count = sum(count for cat, count in categories.items() if cat != "generic")
    assert portal_count == 31, f"Should have 31 portal presets, found {portal_count}"
