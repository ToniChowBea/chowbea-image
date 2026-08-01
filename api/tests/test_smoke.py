def test_pyvips_imports_and_libvips_present():
    import pyvips

    # A trivial black image proves libvips is wired up end to end.
    image = pyvips.Image.black(4, 4)
    assert image.width == 4
    assert image.height == 4
