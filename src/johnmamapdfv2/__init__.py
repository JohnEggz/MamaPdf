def main() -> None:
    print("Hello from johnmamapdfv2!")
    import sys
    if "pytest" not in sys.modules:
        from johnmamapdfv2.app import run
        run()

