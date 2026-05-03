"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import os
from pathlib import Path
import json
import uuid
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Load teacher credentials from JSON file
def load_teachers():
    teachers_file = Path(__file__).parent / "teachers.json"
    with open(teachers_file, "r") as f:
        return json.load(f)

teachers = load_teachers()

# In-memory session storage: session_id -> teacher_username
authenticated_sessions = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


# Pydantic models for request bodies
class LoginRequest(BaseModel):
    username: str
    password: str


# Helper function to verify teacher credentials
def verify_teacher(username: str, password: str) -> bool:
    """Verify if the provided credentials match any teacher"""
    for teacher in teachers["teachers"]:
        if teacher["username"] == username and teacher["password"] == password:
            return True
    return False


# Helper function to check if a session is authenticated
def get_authenticated_user(session_id: Optional[str]) -> Optional[str]:
    """Returns the username if session is valid, None otherwise"""
    return authenticated_sessions.get(session_id)


@app.post("/auth/login")
def login(request: LoginRequest):
    """Authenticate a teacher and create a session"""
    if not verify_teacher(request.username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create a new session
    session_id = str(uuid.uuid4())
    authenticated_sessions[session_id] = request.username
    
    response = JSONResponse(
        {"message": f"Logged in as {request.username}"},
        status_code=200
    )
    response.set_cookie("session_id", session_id, httponly=True, samesite="lax")
    return response


@app.post("/auth/logout")
def logout(session_id: Optional[str] = Cookie(None)):
    """Logout a teacher and invalidate session"""
    if session_id and session_id in authenticated_sessions:
        del authenticated_sessions[session_id]
    
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("session_id")
    return response


@app.get("/auth/status")
def auth_status(session_id: Optional[str] = Cookie(None)):
    """Check if user is authenticated"""
    user = get_authenticated_user(session_id)
    if user:
        return {"authenticated": True, "username": user}
    else:
        return {"authenticated": False}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, session_id: Optional[str] = Cookie(None)):
    """Sign up a student for an activity (teachers only)"""
    # Check authentication
    user = get_authenticated_user(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated. Only teachers can register students.")
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, session_id: Optional[str] = Cookie(None)):
    """Unregister a student from an activity (teachers only)"""
    # Check authentication
    user = get_authenticated_user(session_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated. Only teachers can unregister students.")
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}

