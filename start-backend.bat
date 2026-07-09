cd /d U:\OEE
call venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0
pause