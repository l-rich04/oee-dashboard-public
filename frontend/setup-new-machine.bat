@echo off
echo ================================
echo  OEE Dashboard - Fresh Setup
echo ================================
echo.
echo Step 1 - Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate
echo.
echo Step 2 - Installing Python packages...
pip install -r requirements.txt
echo.
echo Step 3 - Creating database...
python migrate.py
echo.
echo Step 4 - Installing frontend packages...
cd frontend
npm install
cd ..
echo.
echo Setup complete!
echo Run start-backend.bat then start-frontend.bat
pause
