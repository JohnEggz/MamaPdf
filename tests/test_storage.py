from johnmamapdfv2.storage import sanitize_filename_component, sanitize_project_name


def test_sanitize_filename_illegal_chars() -> None:
    assert sanitize_filename_component('a<b>c:d"e/f\\g|h?i*j') == "a_b_c_d_e_f_g_h_i_j"


def test_sanitize_filename_whitespace_collapsed_and_trimmed() -> None:
    assert sanitize_filename_component("  Jan   Kowalski  ") == "Jan_Kowalski"


def test_sanitize_filename_reserved_names() -> None:
    assert sanitize_filename_component("CON") == "_CON"
    assert sanitize_filename_component("lpt1") == "_lpt1"


def test_sanitize_project_name_fallbacks() -> None:
    assert sanitize_project_name("") == "nowy_projekt"
    assert sanitize_project_name("...") == "nowy_projekt"
