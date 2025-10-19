"""
AI Performance Service for optimizing AI Agent operations.
Handles caching, request optimization, and performance monitoring.
"""

import time
import json
import hashlib
from typing import Dict, Any, Optional, List
from functools import lru_cache
from app.utils.logger import SmartLogger
from app.models.canvas_object import CanvasObject
from app.models.canvas import Canvas


class AIPerformanceService:
    """Service for optimizing AI Agent performance."""
    
    def __init__(self):
        # Use WARNING level to reduce log volume on Railway
        self.logger = SmartLogger('ai_performance_service', 'WARNING')
        self.request_cache = {}
        self.performance_metrics = {
            'total_requests': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'average_response_time': 0,
            'total_response_time': 0
        }
    
    def optimize_request(self, query: str, style: str, color_scheme: str) -> Dict[str, Any]:
        """
        Optimize AI request by checking cache and applying optimizations.
        
        Args:
            query: User query
            style: Visual style
            color_scheme: Color scheme
            
        Returns:
            Optimized request data
        """
        start_time = time.time()
        
        # Generate cache key
        cache_key = self._generate_cache_key(query, style, color_scheme)
        
        # Check cache first
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            self.performance_metrics['cache_hits'] += 1
            self.logger.log_info(f"Cache hit for query: {query[:50]}...")
            return cached_result
        
        self.performance_metrics['cache_misses'] += 1
        
        # Optimize query
        optimized_query = self._optimize_query(query)
        
        # Track performance
        self.performance_metrics['total_requests'] += 1
        
        return {
            'optimized_query': optimized_query,
            'cache_key': cache_key,
            'start_time': start_time
        }
    
    def record_response_time(self, start_time: float, cache_key: str, result: Dict[str, Any]):
        """
        Record response time and cache result.
        
        Args:
            start_time: Request start time
            cache_key: Cache key for the request
            result: AI response result
        """
        response_time = time.time() - start_time
        
        # Update performance metrics
        self.performance_metrics['total_response_time'] += response_time
        self.performance_metrics['average_response_time'] = (
            self.performance_metrics['total_response_time'] / 
            self.performance_metrics['total_requests']
        )
        
        # Cache successful results
        if result.get('success'):
            self._cache_result(cache_key, result)
        
        self.logger.log_info(f"AI request completed in {response_time:.2f}s")
    
    def _generate_cache_key(self, query: str, style: str, color_scheme: str) -> str:
        """Generate cache key for request."""
        cache_data = f"{query.lower().strip()}:{style}:{color_scheme}"
        return hashlib.md5(cache_data.encode()).hexdigest()
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get result from cache."""
        return self.request_cache.get(cache_key)
    
    def _cache_result(self, cache_key: str, result: Dict[str, Any]):
        """Cache successful result."""
        # Limit cache size to prevent memory issues
        if len(self.request_cache) > 100:
            # Remove oldest entries
            oldest_key = next(iter(self.request_cache))
            del self.request_cache[oldest_key]
        
        self.request_cache[cache_key] = result
    
    def _optimize_query(self, query: str) -> str:
        """
        Optimize user query for better AI performance.
        
        Args:
            query: Original user query
            
        Returns:
            Optimized query
        """
        # Remove extra whitespace
        optimized = query.strip()
        
        # Add helpful context if query is too short
        if len(optimized) < 10:
            optimized = f"Create a canvas with: {optimized}"
        
        # Add helpful context if query is too vague
        vague_indicators = ['create', 'make', 'draw', 'design']
        if any(indicator in optimized.lower() for indicator in vague_indicators) and len(optimized) < 20:
            optimized = f"{optimized} with clear structure and labels"
        
        return optimized
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics."""
        cache_hit_rate = 0
        if self.performance_metrics['total_requests'] > 0:
            cache_hit_rate = (
                self.performance_metrics['cache_hits'] / 
                self.performance_metrics['total_requests']
            ) * 100
        
        return {
            'total_requests': self.performance_metrics['total_requests'],
            'cache_hits': self.performance_metrics['cache_hits'],
            'cache_misses': self.performance_metrics['cache_misses'],
            'cache_hit_rate': f"{cache_hit_rate:.1f}%",
            'average_response_time': f"{self.performance_metrics['average_response_time']:.2f}s",
            'cache_size': len(self.request_cache)
        }
    
    def clear_cache(self):
        """Clear the request cache."""
        self.request_cache.clear()
        self.logger.log_info("AI performance cache cleared")
    
    def optimize_objects_for_rendering(self, objects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Optimize AI-generated objects for better rendering performance.
        
        Args:
            objects: List of AI-generated objects
            
        Returns:
            Optimized objects
        """
        optimized_objects = []
        
        for obj in objects:
            optimized_obj = obj.copy()
            
            # Ensure required properties exist
            if 'properties' not in optimized_obj:
                optimized_obj['properties'] = {}
            
            properties = optimized_obj['properties']
            
            # Set default values for missing properties
            defaults = {
                'x': 100,
                'y': 100,
                'width': 120,
                'height': 60,
                'fill': '#3B82F6',
                'stroke': '#1E40AF',
                'strokeWidth': 2,
                'fontSize': 14,
                'fontFamily': 'Arial'
            }
            
            for key, default_value in defaults.items():
                if key not in properties:
                    properties[key] = default_value
            
            # Optimize text objects
            if optimized_obj.get('object_type') == 'text':
                if 'text' not in properties:
                    properties['text'] = optimized_obj.get('label', 'Text')
                
                # Ensure text fits within bounds
                text = properties['text']
                if len(text) > 50:
                    properties['text'] = text[:47] + '...'
            
            # Optimize coordinates to prevent overlap
            optimized_obj = self._prevent_object_overlap(optimized_obj, optimized_objects)
            
            optimized_objects.append(optimized_obj)
        
        return optimized_objects
    
    def _prevent_object_overlap(self, obj: Dict[str, Any], existing_objects: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Prevent object overlap by adjusting coordinates.
        
        Args:
            obj: Object to optimize
            existing_objects: List of existing objects
            
        Returns:
            Optimized object
        """
        properties = obj.get('properties', {})
        x = properties.get('x', 100)
        y = properties.get('y', 100)
        width = properties.get('width', 120)
        height = properties.get('height', 60)
        
        # Check for overlaps and adjust position
        for existing_obj in existing_objects:
            existing_props = existing_obj.get('properties', {})
            existing_x = existing_props.get('x', 0)
            existing_y = existing_props.get('y', 0)
            existing_width = existing_props.get('width', 0)
            existing_height = existing_props.get('height', 0)
            
            # Check if objects overlap
            if (x < existing_x + existing_width and 
                x + width > existing_x and 
                y < existing_y + existing_height and 
                y + height > existing_y):
                
                # Move object to the right
                x = existing_x + existing_width + 20
                properties['x'] = x
        
        return obj
    
    @lru_cache(maxsize=128)
    def get_common_patterns(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get common canvas patterns for quick generation.
        
        Returns:
            Dictionary of common patterns
        """
        return {
            'flowchart': [
                {
                    'type': 'rectangle',
                    'label': 'Start',
                    'x': 100,
                    'y': 50,
                    'width': 120,
                    'height': 60,
                    'color': '#10B981'
                },
                {
                    'type': 'diamond',
                    'label': 'Decision',
                    'x': 100,
                    'y': 150,
                    'width': 120,
                    'height': 80,
                    'color': '#F59E0B'
                },
                {
                    'type': 'rectangle',
                    'label': 'End',
                    'x': 100,
                    'y': 270,
                    'width': 120,
                    'height': 60,
                    'color': '#EF4444'
                }
            ],
            'mindmap': [
                {
                    'type': 'circle',
                    'label': 'Central Topic',
                    'x': 200,
                    'y': 200,
                    'width': 100,
                    'height': 100,
                    'color': '#3B82F6'
                },
                {
                    'type': 'rectangle',
                    'label': 'Branch 1',
                    'x': 50,
                    'y': 150,
                    'width': 100,
                    'height': 50,
                    'color': '#10B981'
                },
                {
                    'type': 'rectangle',
                    'label': 'Branch 2',
                    'x': 350,
                    'y': 150,
                    'width': 100,
                    'height': 50,
                    'color': '#F59E0B'
                }
            ],
            'wireframe': [
                {
                    'type': 'rectangle',
                    'label': 'Header',
                    'x': 50,
                    'y': 50,
                    'width': 500,
                    'height': 80,
                    'color': '#6B7280'
                },
                {
                    'type': 'rectangle',
                    'label': 'Sidebar',
                    'x': 50,
                    'y': 150,
                    'width': 150,
                    'height': 300,
                    'color': '#9CA3AF'
                },
                {
                    'type': 'rectangle',
                    'label': 'Main Content',
                    'x': 220,
                    'y': 150,
                    'width': 330,
                    'height': 300,
                    'color': '#D1D5DB'
                }
            ]
        }
    
    def get_pattern_for_query(self, query: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get a common pattern if the query matches a known pattern.
        
        Args:
            query: User query
            
        Returns:
            Pattern objects if found, None otherwise
        """
        query_lower = query.lower()
        patterns = self.get_common_patterns()
        
        # Check for pattern keywords
        if any(keyword in query_lower for keyword in ['flowchart', 'flow', 'process', 'workflow']):
            return patterns['flowchart']
        elif any(keyword in query_lower for keyword in ['mindmap', 'mind map', 'brainstorm']):
            return patterns['mindmap']
        elif any(keyword in query_lower for keyword in ['wireframe', 'layout', 'mockup']):
            return patterns['wireframe']
        
        return None
