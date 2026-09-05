"""
StudySync AI - Flask Backend Server (app.py)

Main Application Entrypoint:
- Configures Flask with CORS
- Loads environment variables from .env
- Registers API Blueprints (/api/chat, /api/history, /api/clear)
- Handles global exceptions and JSON responses
"""

import os
from flask import Flask, jsonify, request, send_from_directory

try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False

from config import Config
from routes.chat_routes import chat_bp
from routes.planner_routes import planner_bp
from routes.retention_routes import retention_bp
try:
    from services.conversation_service import conversation_service
except ImportError:
    from conversation_service import conversation_service

def create_app() -> Flask:
    """Application factory for StudySync AI."""
    # Validate environment settings on startup
    Config.validate()

    app = Flask(__name__, static_folder="../frontend", static_url_path="")

    # Enable Cross-Origin Resource Sharing (CORS)
    if HAS_CORS:
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    else:
        @app.after_request
        def add_cors_headers(response):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
            return response

    # Register Blueprints
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(planner_bp, url_prefix="/api")
    app.register_blueprint(retention_bp, url_prefix="/api")

    # --------------------------------------------------------------------------
    # Health Check & Root Endpoints
    # --------------------------------------------------------------------------
    @app.route("/health", methods=["GET"])
    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Health check endpoint for verifying backend status."""
        return jsonify({
            "status": "online",
            "service": "StudySync AI Educational Chatbot",
            "version": "1.0.0",
            "gemini_configured": bool(Config.GEMINI_API_KEY),
            "memory_type": "in-memory-python-dict",
            "active_sessions": len(conversation_service.conversation_memory)
        }), 200


    # Serve Frontend UI when opened via Flask
    @app.route("/")
    def serve_index():
        return send_from_directory(app.static_folder, "index.html")

    # --------------------------------------------------------------------------
    # Global Error Handlers
    # --------------------------------------------------------------------------
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "error": "Endpoint not found",
            "message": "The requested API route does not exist."
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred on the server."
        }), 500

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "error": "Bad request",
            "message": "The request payload was malformed or missing required parameters."
        }), 400

    return app

# Application instance
app = create_app()

if __name__ == "__main__":
    print(f">> StudySync AI Server running on http://{Config.HOST}:{Config.PORT}")
    print(f">> Chat API Endpoint: http://{Config.HOST}:{Config.PORT}/api/chat")
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )
