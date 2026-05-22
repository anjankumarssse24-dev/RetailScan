"""
Smart Retail Checkout System - Entry Point
"""
from app import create_app
from app.services.camera_service import release_camera

app = create_app()

if __name__ == "__main__":
    print("=" * 50)
    print("  Smart Retail Checkout System")
    print("  Starting server at http://localhost:5000")
    print("=" * 50)

    try:
        app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
    finally:
        release_camera()
