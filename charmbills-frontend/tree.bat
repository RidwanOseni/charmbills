@echo off
echo Project structure for %cd%
echo ===============================
echo.

:: List only directories that exist
if exist src (
    echo src
    tree src /F /A
)

if exist app (
    echo app
    tree app /F /A
)

if exist components (
    echo components
    tree components /F /A
)

if exist lib (
    echo lib
    tree lib /F /A
)

if exist public (
    echo public
    tree public /F /A
)

if exist tests (
    echo tests
    tree tests /F /A
)

if exist __tests__ (
    echo __tests__
    tree __tests__ /F /A
)

echo.
echo Additional files in root:
dir /B /A:-D