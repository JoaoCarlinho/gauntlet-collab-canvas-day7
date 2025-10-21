"""
JSON Serialization Testing Utility
Tests JSON serialization of socket message data to identify parse error causes.
"""

import json
import time
from typing import Dict, Any, List, Optional, Tuple
from app.utils.railway_logger import railway_logger

class JSONSerializationTester:
    """Tests JSON serialization of socket message data."""
    
    def __init__(self):
        self.test_results = []
        self.serialization_errors = []
        self.start_time = time.time()
    
    def test_serialization(self, data: Any, context: str = 'unknown') -> Dict[str, Any]:
        """Test JSON serialization of data."""
        test_result = {
            'context': context,
            'timestamp': time.time(),
            'success': False,
            'error': None,
            'serialized_size': 0,
            'serialization_time': 0,
            'data_type': type(data).__name__,
            'data_structure': self._analyze_data_structure(data)
        }
        
        try:
            start_time = time.time()
            serialized = json.dumps(data)
            end_time = time.time()
            
            test_result.update({
                'success': True,
                'serialized_size': len(serialized.encode('utf-8')),
                'serialization_time': end_time - start_time
            })
            
            railway_logger.log('json_serialization', 10, f"JSON serialization successful for {context}")
            
        except TypeError as e:
            test_result['error'] = f"TypeError: {str(e)}"
            self.serialization_errors.append(test_result)
            railway_logger.log('json_serialization', 30, f"JSON serialization TypeError for {context}: {str(e)}")
            
        except ValueError as e:
            test_result['error'] = f"ValueError: {str(e)}"
            self.serialization_errors.append(test_result)
            railway_logger.log('json_serialization', 30, f"JSON serialization ValueError for {context}: {str(e)}")
            
        except Exception as e:
            test_result['error'] = f"Unexpected error: {str(e)}"
            self.serialization_errors.append(test_result)
            railway_logger.log('json_serialization', 40, f"JSON serialization unexpected error for {context}: {str(e)}")
        
        self.test_results.append(test_result)
        return test_result
    
    def test_object_properties(self, object_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test serialization of object properties."""
        results = {
            'overall_success': True,
            'property_tests': {},
            'failed_properties': [],
            'total_properties': len(object_data),
            'successful_properties': 0
        }
        
        for key, value in object_data.items():
            property_result = self.test_serialization(value, f"object_property_{key}")
            results['property_tests'][key] = property_result
            
            if property_result['success']:
                results['successful_properties'] += 1
            else:
                results['failed_properties'].append({
                    'property': key,
                    'error': property_result['error']
                })
                results['overall_success'] = False
        
        return results
    
    def test_firebase_token(self, token: str) -> Dict[str, Any]:
        """Test serialization of Firebase token."""
        return self.test_serialization(token, 'firebase_token')
    
    def test_circular_references(self, data: Any) -> Dict[str, Any]:
        """Test for circular references in data."""
        visited = set()
        circular_refs = []
        
        def check_circular(obj, path=""):
            if id(obj) in visited:
                circular_refs.append(f"Circular reference at path: {path}")
                return
            
            visited.add(id(obj))
            
            if isinstance(obj, dict):
                for key, value in obj.items():
                    check_circular(value, f"{path}.{key}")
            elif isinstance(obj, (list, tuple)):
                for i, item in enumerate(obj):
                    check_circular(item, f"{path}[{i}]")
            
            visited.discard(id(obj))
        
        try:
            check_circular(data)
            
            result = {
                'has_circular_refs': len(circular_refs) > 0,
                'circular_refs': circular_refs,
                'serialization_test': self.test_serialization(data, 'circular_reference_test')
            }
            
            return result
            
        except Exception as e:
            return {
                'has_circular_refs': True,
                'error': str(e),
                'serialization_test': {'success': False, 'error': str(e)}
            }
    
    def test_special_characters(self, data: Any) -> Dict[str, Any]:
        """Test serialization with special characters."""
        special_chars_found = []
        
        def find_special_chars(obj, path=""):
            if isinstance(obj, str):
                for i, char in enumerate(obj):
                    if ord(char) < 32 and char not in '\t\n\r':
                        special_chars_found.append({
                            'path': f"{path}[{i}]",
                            'char': repr(char),
                            'ord': ord(char)
                        })
            elif isinstance(obj, dict):
                for key, value in obj.items():
                    find_special_chars(value, f"{path}.{key}")
            elif isinstance(obj, (list, tuple)):
                for i, item in enumerate(obj):
                    find_special_chars(item, f"{path}[{i}]")
        
        find_special_chars(data)
        
        result = {
            'has_special_chars': len(special_chars_found) > 0,
            'special_chars': special_chars_found,
            'serialization_test': self.test_serialization(data, 'special_characters_test')
        }
        
        return result
    
    def test_large_data_structures(self, data: Any) -> Dict[str, Any]:
        """Test serialization of large data structures."""
        size_analysis = self._analyze_data_size(data)
        
        result = {
            'size_analysis': size_analysis,
            'is_large': size_analysis['estimated_size'] > 1000000,  # 1MB
            'serialization_test': self.test_serialization(data, 'large_data_structure_test')
        }
        
        return result
    
    def _analyze_data_structure(self, data: Any) -> Dict[str, Any]:
        """Analyze the structure of data."""
        analysis = {
            'type': type(data).__name__,
            'is_dict': isinstance(data, dict),
            'is_list': isinstance(data, (list, tuple)),
            'is_string': isinstance(data, str),
            'is_numeric': isinstance(data, (int, float)),
            'is_boolean': isinstance(data, bool),
            'is_none': data is None,
            'depth': 0,
            'key_count': 0,
            'value_count': 0
        }
        
        if isinstance(data, dict):
            analysis['key_count'] = len(data)
            analysis['keys'] = list(data.keys())
        elif isinstance(data, (list, tuple)):
            analysis['value_count'] = len(data)
        
        # Calculate depth
        analysis['depth'] = self._calculate_depth(data)
        
        return analysis
    
    def _calculate_depth(self, data: Any, current_depth: int = 0, max_depth: int = 0) -> int:
        """Calculate the maximum depth of nested data structures."""
        if current_depth > max_depth:
            max_depth = current_depth
        
        if isinstance(data, dict):
            for value in data.values():
                max_depth = self._calculate_depth(value, current_depth + 1, max_depth)
        elif isinstance(data, (list, tuple)):
            for item in data:
                max_depth = self._calculate_depth(item, current_depth + 1, max_depth)
        
        return max_depth
    
    def _analyze_data_size(self, data: Any) -> Dict[str, Any]:
        """Analyze the estimated size of data."""
        try:
            serialized = json.dumps(data)
            actual_size = len(serialized.encode('utf-8'))
            
            return {
                'estimated_size': actual_size,
                'string_length': len(serialized),
                'is_large': actual_size > 1000000
            }
        except Exception as e:
            return {
                'estimated_size': 0,
                'string_length': 0,
                'is_large': False,
                'error': str(e)
            }
    
    def get_test_summary(self) -> Dict[str, Any]:
        """Get summary of all serialization tests."""
        total_tests = len(self.test_results)
        successful_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - successful_tests
        
        error_types = {}
        for error in self.serialization_errors:
            error_type = error['error'].split(':')[0] if error['error'] else 'Unknown'
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        return {
            'total_tests': total_tests,
            'successful_tests': successful_tests,
            'failed_tests': failed_tests,
            'success_rate': successful_tests / total_tests if total_tests > 0 else 0,
            'error_types': error_types,
            'recent_errors': self.serialization_errors[-10:],  # Last 10 errors
            'uptime_seconds': time.time() - self.start_time
        }
    
    def get_recommendations(self) -> List[str]:
        """Get recommendations based on serialization test results."""
        recommendations = []
        summary = self.get_test_summary()
        
        if summary['success_rate'] < 0.95:
            recommendations.append(f"Low serialization success rate: {summary['success_rate']:.1%}")
        
        for error_type, count in summary['error_types'].items():
            if count > 3:
                recommendations.append(f"Address {error_type}: {count} occurrences")
        
        if summary['failed_tests'] > 10:
            recommendations.append("High number of serialization failures detected")
        
        return recommendations
    
    def reset_tests(self) -> None:
        """Reset all test data."""
        self.test_results.clear()
        self.serialization_errors.clear()
        self.start_time = time.time()
        railway_logger.log('json_serialization', 10, "JSON serialization tests reset")

# Global instance
json_serialization_tester = JSONSerializationTester()
