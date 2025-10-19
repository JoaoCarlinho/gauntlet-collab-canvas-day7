"""
OpenAI Client Factory
Provides a factory for creating OpenAI clients with proper configuration
and fallback mechanisms to avoid the proxies argument issue.
"""

import openai
import os
from typing import Optional, Dict, Any
from app.utils.logger import SmartLogger

logger = SmartLogger('openai_client_factory', 'WARNING')


class OpenAIClientFactory:
    """Factory for creating OpenAI clients with proper configuration."""
    
    @staticmethod
    def create_client(api_key: Optional[str] = None) -> Optional[openai.OpenAI]:
        """
        Create an OpenAI client with proper configuration.
        
        Args:
            api_key: OpenAI API key (if None, will try to get from environment)
            
        Returns:
            OpenAI client instance or None if creation fails
        """
        try:
            # Get API key
            if not api_key:
                api_key = os.environ.get('OPENAI_API_KEY')
            
            if not api_key:
                logger.log_error("OpenAI API key not provided")
                return None
            
            # Clean environment variables that might cause issues
            OpenAIClientFactory._clean_proxy_environment()
            
            # Try different client creation strategies
            client = OpenAIClientFactory._try_create_client(api_key)
            
            if client:
                logger.log_info("OpenAI client created successfully")
                return client
            else:
                logger.log_error("Failed to create OpenAI client with all strategies")
                return None
                
        except Exception as e:
            logger.log_error(f"OpenAI client factory error: {str(e)}", e)
            return None
    
    @staticmethod
    def _clean_proxy_environment():
        """Clean proxy-related environment variables that might cause issues."""
        proxy_vars = [
            'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
            'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy',
            'FTP_PROXY', 'ftp_proxy', 'SOCKS_PROXY', 'socks_proxy'
        ]
        
        for var in proxy_vars:
            if var in os.environ:
                logger.log_info(f"Removing proxy environment variable: {var}")
                del os.environ[var]
    
    @staticmethod
    def _try_create_client(api_key: str) -> Optional[openai.OpenAI]:
        """Try different strategies to create OpenAI client."""
        
        # Strategy 1: Minimal configuration
        try:
            logger.log_info("Trying OpenAI client creation with minimal configuration")
            client = openai.OpenAI(api_key=api_key)
            # Test the client
            client.models.list()
            return client
        except Exception as e:
            logger.log_warning(f"Minimal configuration failed: {str(e)}")
        
        # Strategy 2: With timeout
        try:
            logger.log_info("Trying OpenAI client creation with timeout")
            client = openai.OpenAI(
                api_key=api_key,
                timeout=30.0
            )
            # Test the client
            client.models.list()
            return client
        except Exception as e:
            logger.log_warning(f"Timeout configuration failed: {str(e)}")
        
        # Strategy 3: With explicit None for problematic parameters
        try:
            logger.log_info("Trying OpenAI client creation with explicit None parameters")
            client = openai.OpenAI(
                api_key=api_key,
                timeout=30.0,
                max_retries=2,
                proxies=None  # Explicitly set to None
            )
            # Test the client
            client.models.list()
            return client
        except Exception as e:
            logger.log_warning(f"Explicit None parameters failed: {str(e)}")
        
        # Strategy 4: Try with different parameter combinations
        try:
            logger.log_info("Trying OpenAI client creation with alternative parameters")
            client_kwargs = {
                'api_key': api_key,
                'timeout': 30.0
            }
            client = openai.OpenAI(**client_kwargs)
            # Test the client
            client.models.list()
            return client
        except Exception as e:
            logger.log_warning(f"Alternative parameters failed: {str(e)}")
        
        # Strategy 5: Try with only api_key and handle errors gracefully
        try:
            logger.log_info("Trying OpenAI client creation with api_key only")
            client = openai.OpenAI(api_key=api_key)
            return client
        except Exception as e:
            logger.log_warning(f"API key only failed: {str(e)}")
        
        return None
    
    @staticmethod
    def test_client(client: openai.OpenAI) -> bool:
        """
        Test if an OpenAI client is working properly.
        
        Args:
            client: OpenAI client to test
            
        Returns:
            True if client is working, False otherwise
        """
        try:
            # Try to list models (this will test the connection)
            models = client.models.list()
            logger.log_info(f"OpenAI client test successful, found {len(models.data)} models")
            return True
        except Exception as e:
            logger.log_error(f"OpenAI client test failed: {str(e)}", e)
            return False
    
    @staticmethod
    def get_client_info() -> Dict[str, Any]:
        """
        Get information about OpenAI client configuration.
        
        Returns:
            Dictionary with client configuration info
        """
        info = {
            'api_key_set': bool(os.environ.get('OPENAI_API_KEY')),
            'api_key_length': len(os.environ.get('OPENAI_API_KEY', '')),
            'openai_version': openai.__version__,
            'proxy_vars': {
                var: bool(os.environ.get(var)) 
                for var in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
            }
        }
        
        return info
