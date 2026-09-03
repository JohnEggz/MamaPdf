import pytest
from johnmamapdfv2 import main


def test_main(capsys: pytest.CaptureFixture[str]):
    main()
    captured = capsys.readouterr()
    assert "Hello from johnmamapdfv2!" in captured.out
