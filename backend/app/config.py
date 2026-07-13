from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deriv_app_id: str = "1089"
    deriv_api_token: str = ""
    deriv_ws_url: str = "wss://ws.binaryws.com/websockets/v3"

    model_config = {"env_file": ".env"}


settings = Settings()
