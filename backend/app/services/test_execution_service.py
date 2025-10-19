"""
Test Execution Service for automated production testing.
Manages test execution, result collection, and reporting.
"""

import json
import uuid
import asyncio
import subprocess
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from app.utils.logger import SmartLogger
from app.models.test_user import TestUser
from app.extensions import db

logger = SmartLogger('test_execution_service', 'WARNING')

class TestStatus(Enum):
    """Test execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

class TestType(Enum):
    """Test types."""
    E2E = "e2e"
    API = "api"
    SECURITY = "security"
    PERFORMANCE = "performance"
    INTEGRATION = "integration"

class TestExecution:
    """Represents a test execution session."""
    
    def __init__(self, execution_id: str, user: TestUser, test_type: TestType, 
                 test_suite: str, config: Dict[str, Any]):
        self.execution_id = execution_id
        self.user = user
        self.test_type = test_type
        self.test_suite = test_suite
        self.config = config
        self.status = TestStatus.PENDING
        self.start_time = None
        self.end_time = None
        self.results = {}
        self.logs = []
        self.errors = []
        self.metrics = {}
        
        # Store in memory (in production, use Redis or database)
        self._store_execution()
    
    def _store_execution(self):
        """Store execution in memory cache."""
        # In production, store in Redis or database
        if not hasattr(TestExecutionService, '_executions'):
            TestExecutionService._executions = {}
        TestExecutionService._executions[self.execution_id] = self
    
    def start(self):
        """Start test execution."""
        self.status = TestStatus.RUNNING
        self.start_time = datetime.now(timezone.utc)
        self._log(f"Test execution started: {self.execution_id}")
    
    def complete(self, results: Dict[str, Any], metrics: Dict[str, Any] = None):
        """Complete test execution."""
        self.status = TestStatus.COMPLETED
        self.end_time = datetime.now(timezone.utc)
        self.results = results
        self.metrics = metrics or {}
        self._log(f"Test execution completed: {self.execution_id}")
    
    def fail(self, error: str, results: Dict[str, Any] = None):
        """Mark test execution as failed."""
        self.status = TestStatus.FAILED
        self.end_time = datetime.now(timezone.utc)
        self.errors.append(error)
        self.results = results or {}
        self._log(f"Test execution failed: {self.execution_id} - {error}")
    
    def cancel(self, reason: str = "User cancelled"):
        """Cancel test execution."""
        self.status = TestStatus.CANCELLED
        self.end_time = datetime.now(timezone.utc)
        self.errors.append(reason)
        self._log(f"Test execution cancelled: {self.execution_id} - {reason}")
    
    def timeout(self):
        """Mark test execution as timed out."""
        self.status = TestStatus.TIMEOUT
        self.end_time = datetime.now(timezone.utc)
        self.errors.append("Test execution timed out")
        self._log(f"Test execution timed out: {self.execution_id}")
    
    def _log(self, message: str):
        """Add log entry."""
        timestamp = datetime.now(timezone.utc).isoformat()
        self.logs.append(f"[{timestamp}] {message}")
        logger.log_info(message)
    
    def add_error(self, error: str):
        """Add error to execution."""
        self.errors.append(error)
        self._log(f"ERROR: {error}")
    
    def get_duration(self) -> Optional[float]:
        """Get execution duration in seconds."""
        if not self.start_time:
            return None
        end_time = self.end_time or datetime.now(timezone.utc)
        return (end_time - self.start_time).total_seconds()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert execution to dictionary."""
        return {
            'execution_id': self.execution_id,
            'user_id': self.user.id,
            'user_email': self.user.email,
            'test_type': self.test_type.value,
            'test_suite': self.test_suite,
            'status': self.status.value,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration': self.get_duration(),
            'results': self.results,
            'metrics': self.metrics,
            'errors': self.errors,
            'logs': self.logs[-50:],  # Last 50 log entries
            'config': self.config
        }

class TestExecutionService:
    """Service for managing test executions."""
    
    # Class variable to store executions (in production, use Redis)
    _executions = {}
    
    def __init__(self):
        self.max_concurrent_executions = 3
        self.default_timeout_minutes = 30
        self.active_executions = set()
    
    def create_execution(self, user: TestUser, test_type: str, test_suite: str, 
                        config: Dict[str, Any] = None) -> TestExecution:
        """Create a new test execution."""
        try:
            # Validate user permissions
            if not user.can_execute_test_type(test_type):
                raise ValueError(f"User {user.email} does not have permission to execute {test_type} tests")
            
            # Check concurrent execution limit
            if len(self.active_executions) >= self.max_concurrent_executions:
                raise ValueError("Maximum concurrent executions reached")
            
            # Generate execution ID
            execution_id = str(uuid.uuid4())
            
            # Create execution
            execution = TestExecution(
                execution_id=execution_id,
                user=user,
                test_type=TestType(test_type),
                test_suite=test_suite,
                config=config or {}
            )
            
            self.active_executions.add(execution_id)
            logger.log_info(f"Created test execution {execution_id} for user {user.email}")
            
            return execution
            
        except Exception as e:
            logger.log_error(f"Failed to create test execution: {str(e)}", e)
            raise
    
    async def execute_test(self, execution: TestExecution) -> Dict[str, Any]:
        """Execute a test suite."""
        try:
            execution.start()
            
            # Determine test command based on type
            test_command = self._get_test_command(execution)
            
            # Execute test
            results = await self._run_test_command(test_command, execution)
            
            # Process results
            processed_results = self._process_results(results, execution)
            
            # Complete execution
            execution.complete(processed_results, self._extract_metrics(results))
            
            # Remove from active executions
            self.active_executions.discard(execution.execution_id)
            
            return execution.to_dict()
            
        except asyncio.TimeoutError:
            execution.timeout()
            self.active_executions.discard(execution.execution_id)
            raise
        except Exception as e:
            execution.fail(str(e))
            self.active_executions.discard(execution.execution_id)
            raise
    
    def _get_test_command(self, execution: TestExecution) -> List[str]:
        """Get the command to run for the test type."""
        base_command = ["npm", "run", "test"]
        
        if execution.test_type == TestType.E2E:
            return base_command + ["--", "--spec", f"cypress/e2e/{execution.test_suite}.cy.ts"]
        elif execution.test_type == TestType.API:
            return base_command + ["--", "--testPathPattern", f"api/{execution.test_suite}"]
        elif execution.test_type == TestType.SECURITY:
            return base_command + ["--", "--testPathPattern", f"security/{execution.test_suite}"]
        elif execution.test_type == TestType.PERFORMANCE:
            return base_command + ["--", "--testPathPattern", f"performance/{execution.test_suite}"]
        elif execution.test_type == TestType.INTEGRATION:
            return base_command + ["--", "--testPathPattern", f"integration/{execution.test_suite}"]
        else:
            return base_command
    
    async def _run_test_command(self, command: List[str], execution: TestExecution) -> Dict[str, Any]:
        """Run the test command and return results."""
        try:
            # Set timeout
            timeout_seconds = execution.config.get('timeout_minutes', self.default_timeout_minutes) * 60
            
            # Run command
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/app"  # Adjust path as needed
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), 
                    timeout=timeout_seconds
                )
                
                return {
                    'returncode': process.returncode,
                    'stdout': stdout.decode('utf-8'),
                    'stderr': stderr.decode('utf-8'),
                    'success': process.returncode == 0
                }
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise asyncio.TimeoutError("Test execution timed out")
                
        except Exception as e:
            logger.log_error(f"Failed to run test command: {str(e)}", e)
            raise
    
    def _process_results(self, raw_results: Dict[str, Any], execution: TestExecution) -> Dict[str, Any]:
        """Process raw test results."""
        try:
            processed = {
                'success': raw_results['success'],
                'returncode': raw_results['returncode'],
                'output': raw_results['stdout'],
                'errors': raw_results['stderr'],
                'test_type': execution.test_type.value,
                'test_suite': execution.test_suite,
                'execution_id': execution.execution_id
            }
            
            # Try to parse JSON output if available
            try:
                if raw_results['stdout']:
                    json_output = json.loads(raw_results['stdout'])
                    processed['parsed_results'] = json_output
            except json.JSONDecodeError:
                pass  # Not JSON output, that's fine
            
            return processed
            
        except Exception as e:
            logger.log_error(f"Failed to process results: {str(e)}", e)
            return {
                'success': False,
                'error': f"Failed to process results: {str(e)}",
                'raw_output': raw_results
            }
    
    def _extract_metrics(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Extract performance metrics from results."""
        metrics = {
            'execution_time': results.get('execution_time'),
            'memory_usage': results.get('memory_usage'),
            'cpu_usage': results.get('cpu_usage')
        }
        
        # Try to extract metrics from parsed results
        if 'parsed_results' in results:
            parsed = results['parsed_results']
            if 'stats' in parsed:
                metrics.update(parsed['stats'])
        
        return {k: v for k, v in metrics.items() if v is not None}
    
    def get_execution(self, execution_id: str) -> Optional[TestExecution]:
        """Get execution by ID."""
        return self._executions.get(execution_id)
    
    def get_user_executions(self, user: TestUser, limit: int = 50) -> List[Dict[str, Any]]:
        """Get executions for a user."""
        user_executions = [
            exec_obj for exec_obj in self._executions.values()
            if exec_obj.user.id == user.id
        ]
        
        # Sort by start time (newest first)
        user_executions.sort(key=lambda x: x.start_time or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        
        return [exec_obj.to_dict() for exec_obj in user_executions[:limit]]
    
    def cancel_execution(self, execution_id: str, user: TestUser) -> bool:
        """Cancel a running execution."""
        execution = self.get_execution(execution_id)
        if not execution:
            return False
        
        if execution.user.id != user.id:
            return False
        
        if execution.status not in [TestStatus.PENDING, TestStatus.RUNNING]:
            return False
        
        execution.cancel("Cancelled by user")
        self.active_executions.discard(execution_id)
        return True
    
    def get_execution_status(self) -> Dict[str, Any]:
        """Get overall execution status."""
        total_executions = len(self._executions)
        active_executions = len(self.active_executions)
        
        status_counts = {}
        for execution in self._executions.values():
            status = execution.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'total_executions': total_executions,
            'active_executions': active_executions,
            'max_concurrent': self.max_concurrent_executions,
            'status_counts': status_counts,
            'active_execution_ids': list(self.active_executions)
        }
