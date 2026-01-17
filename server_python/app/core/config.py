"""
Configuration management using Pydantic Settings
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

ENV_FILE = ".env" if os.path.isfile(".env") and os.access(".env", os.R_OK) else None


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Required settings
    jwt_secret: str
    vite_app_id: str
    
    # Optional settings
    database_url: str = ""
    oauth_server_url: str = ""
    owner_open_id: str = ""
    
    # Forge API
    forge_api_url: str = ""
    forge_api_key: str = ""
    
    # Cookie settings
    cookie_same_site: str = "lax"
    allowed_origins: str = ""
    
    # Cognito settings
    cognito_region: str = ""
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_domain: str = ""
    cognito_jwks_url: str = ""
    
    # Environment
    node_env: str = "development"
    
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.node_env.lower() == "production"
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Get allowed origins as a list"""
        if not self.allowed_origins:
            return []
        return [
            origin.strip() 
            for origin in self.allowed_origins.split(",") 
            if origin.strip()
        ]
    
    def cognito_issuer(self) -> str:
        """Get Cognito issuer URL"""
        if not self.cognito_region or not self.cognito_user_pool_id:
            return ""
        return f"https://cognito-idp.{self.cognito_region}.amazonaws.com/{self.cognito_user_pool_id}"
    
    def cognito_jwks_url_final(self) -> str:
        """Get Cognito JWKS URL (from env or auto-generated)"""
        if self.cognito_jwks_url:
            return self.cognito_jwks_url
        if self.cognito_region and self.cognito_user_pool_id:
            return f"{self.cognito_issuer()}/.well-known/jwks.json"
        return ""
    
    def validate(self) -> None:
        """Validate required settings"""
        errors = []
        warnings = []
        
        if not self.jwt_secret:
            errors.append("JWT_SECRET is required")
        
        if not self.vite_app_id:
            errors.append("VITE_APP_ID is required")
        
        if self.is_production():
            if not self.allowed_origins:
                warnings.append("ALLOWED_ORIGINS is not set. CORS protection may be incomplete.")
            
            has_oauth = bool(self.oauth_server_url)
            has_cognito = bool(
                self.cognito_region and 
                self.cognito_user_pool_id and 
                self.cognito_client_id
            )
            
            if not has_oauth and not has_cognito:
                warnings.append(
                    "Neither OAUTH_SERVER_URL nor Cognito configuration is set. "
                    "Authentication may not work."
                )
        
        if warnings:
            import warnings as py_warnings
            for warning in warnings:
                py_warnings.warn(f"[Environment] {warning}", UserWarning)
        
        if errors:
            raise ValueError(f"Missing required environment variables: {', '.join(errors)}")


# Global settings instance
settings = Settings()
settings.validate()
