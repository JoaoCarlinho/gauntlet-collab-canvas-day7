#!/usr/bin/env python3

"""
🛡️ CollabCanvas Test Reliability Improver
Advanced system for improving test reliability and reducing flakiness
"""

import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import asyncio
import aiohttp
from collections import defaultdict, Counter
import statistics
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
RELIABILITY_DIR = PROJECT_ROOT / "test-reliability"
ANALYSIS_DIR = PROJECT_ROOT / "reliability-analysis"
LOG_DIR = PROJECT_ROOT / "logs"

# Create directories
RELIABILITY_DIR.mkdir(exist_ok=True)
ANALYSIS_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'test-reliability-improver.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TestReliabilityMetrics:
    """Test reliability metrics"""
    test_id: str
    total_runs: int
    successful_runs: int
    failed_runs: int
    flaky_runs: int
    success_rate: float
    flakiness_score: float
    average_duration: float
    duration_variance: float
    failure_patterns: List[str]
    reliability_score: float

@dataclass
class FlakinessAnalysis:
    """Flakiness analysis results"""
    test_id: str
    flakiness_level: str
    flakiness_score: float
    common_failure_causes: List[str]
    environmental_factors: List[str]
    timing_issues: List[str]
    recommendations: List[str]

class TestReliabilityAnalyzer:
    """Analyzer for test reliability and flakiness"""
    
    def __init__(self):
        self.test_history = []
        self.flakiness_patterns = {}
        self.reliability_metrics = {}
        
    def load_test_history(self, history_file: Path) -> None:
        """Load test execution history"""
        logger.info(f"Loading test history from: {history_file}")
        
        with open(history_file, 'r') as f:
            data = json.load(f)
        
        self.test_history.extend(data)
        logger.info(f"Loaded {len(data)} test execution records")
    
    def analyze_test_reliability(self, test_id: str) -> TestReliabilityMetrics:
        """Analyze reliability metrics for a specific test"""
        logger.info(f"Analyzing reliability for test: {test_id}")
        
        # Filter test history for this test
        test_runs = [run for run in self.test_history if run.get('test_id') == test_id]
        
        if not test_runs:
            logger.warning(f"No history found for test: {test_id}")
            return TestReliabilityMetrics(
                test_id=test_id,
                total_runs=0,
                successful_runs=0,
                failed_runs=0,
                flaky_runs=0,
                success_rate=0.0,
                flakiness_score=0.0,
                average_duration=0.0,
                duration_variance=0.0,
                failure_patterns=[],
                reliability_score=0.0
            )
        
        # Calculate basic metrics
        total_runs = len(test_runs)
        successful_runs = sum(1 for run in test_runs if run.get('status') == 'passed')
        failed_runs = sum(1 for run in test_runs if run.get('status') == 'failed')
        
        # Calculate flakiness (tests that sometimes pass, sometimes fail)
        status_counts = Counter(run.get('status') for run in test_runs)
        has_passes = status_counts.get('passed', 0) > 0
        has_failures = status_counts.get('failed', 0) > 0
        flaky_runs = 1 if has_passes and has_failures else 0
        
        # Calculate rates
        success_rate = (successful_runs / total_runs) * 100 if total_runs > 0 else 0
        flakiness_score = (flaky_runs / total_runs) * 100 if total_runs > 0 else 0
        
        # Calculate duration metrics
        durations = [run.get('duration', 0) for run in test_runs if run.get('duration')]
        average_duration = statistics.mean(durations) if durations else 0
        duration_variance = statistics.variance(durations) if len(durations) > 1 else 0
        
        # Analyze failure patterns
        failure_patterns = self._analyze_failure_patterns(test_runs)
        
        # Calculate overall reliability score
        reliability_score = self._calculate_reliability_score(
            success_rate, flakiness_score, duration_variance, total_runs
        )
        
        metrics = TestReliabilityMetrics(
            test_id=test_id,
            total_runs=total_runs,
            successful_runs=successful_runs,
            failed_runs=failed_runs,
            flaky_runs=flaky_runs,
            success_rate=success_rate,
            flakiness_score=flakiness_score,
            average_duration=average_duration,
            duration_variance=duration_variance,
            failure_patterns=failure_patterns,
            reliability_score=reliability_score
        )
        
        self.reliability_metrics[test_id] = metrics
        logger.info(f"Reliability analysis completed for {test_id}: {reliability_score:.2f} score")
        return metrics
    
    def _analyze_failure_patterns(self, test_runs: List[Dict]) -> List[str]:
        """Analyze patterns in test failures"""
        patterns = []
        
        # Time-based patterns
        failure_times = [run.get('timestamp') for run in test_runs if run.get('status') == 'failed']
        if failure_times:
            # Check for time-of-day patterns
            hours = [datetime.fromisoformat(t).hour for t in failure_times]
            hour_counts = Counter(hours)
            if len(hour_counts) > 1:
                most_common_hour = hour_counts.most_common(1)[0]
                if most_common_hour[1] > len(failure_times) * 0.5:
                    patterns.append(f"Failures concentrated around hour {most_common_hour[0]}")
        
        # Duration patterns
        failed_durations = [run.get('duration', 0) for run in test_runs if run.get('status') == 'failed']
        if failed_durations:
            avg_failed_duration = statistics.mean(failed_durations)
            if avg_failed_duration > 30:  # More than 30 seconds
                patterns.append("Failures associated with long execution times")
        
        # Error message patterns
        error_messages = [run.get('error_message', '') for run in test_runs if run.get('status') == 'failed']
        if error_messages:
            common_errors = Counter(error_messages)
            if len(common_errors) > 0:
                most_common_error = common_errors.most_common(1)[0]
                if most_common_error[1] > len(error_messages) * 0.3:
                    patterns.append(f"Common error: {most_common_error[0][:50]}...")
        
        return patterns
    
    def _calculate_reliability_score(self, success_rate: float, flakiness_score: float, 
                                   duration_variance: float, total_runs: int) -> float:
        """Calculate overall reliability score (0-100)"""
        # Base score from success rate
        base_score = success_rate
        
        # Penalty for flakiness
        flakiness_penalty = flakiness_score * 0.5
        
        # Penalty for high duration variance (inconsistent timing)
        variance_penalty = min(duration_variance / 100, 10)  # Cap at 10 points
        
        # Bonus for more runs (more data = more confidence)
        confidence_bonus = min(total_runs / 100, 5)  # Cap at 5 points
        
        reliability_score = base_score - flakiness_penalty - variance_penalty + confidence_bonus
        return max(0, min(100, reliability_score))  # Clamp between 0 and 100
    
    def identify_flaky_tests(self, threshold: float = 10.0) -> List[FlakinessAnalysis]:
        """Identify flaky tests based on flakiness score threshold"""
        logger.info(f"Identifying flaky tests with threshold: {threshold}%")
        
        flaky_tests = []
        
        for test_id, metrics in self.reliability_metrics.items():
            if metrics.flakiness_score >= threshold:
                analysis = self._analyze_flakiness(test_id, metrics)
                flaky_tests.append(analysis)
        
        # Sort by flakiness score (most flaky first)
        flaky_tests.sort(key=lambda x: x.flakiness_score, reverse=True)
        
        logger.info(f"Identified {len(flaky_tests)} flaky tests")
        return flaky_tests
    
    def _analyze_flakiness(self, test_id: str, metrics: TestReliabilityMetrics) -> FlakinessAnalysis:
        """Analyze flakiness for a specific test"""
        # Get test runs for detailed analysis
        test_runs = [run for run in self.test_history if run.get('test_id') == test_id]
        
        # Determine flakiness level
        if metrics.flakiness_score >= 50:
            flakiness_level = "Critical"
        elif metrics.flakiness_score >= 25:
            flakiness_level = "High"
        elif metrics.flakiness_score >= 10:
            flakiness_level = "Medium"
        else:
            flakiness_level = "Low"
        
        # Analyze common failure causes
        common_failure_causes = self._identify_failure_causes(test_runs)
        
        # Analyze environmental factors
        environmental_factors = self._identify_environmental_factors(test_runs)
        
        # Analyze timing issues
        timing_issues = self._identify_timing_issues(test_runs)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(metrics, common_failure_causes, 
                                                       environmental_factors, timing_issues)
        
        return FlakinessAnalysis(
            test_id=test_id,
            flakiness_level=flakiness_level,
            flakiness_score=metrics.flakiness_score,
            common_failure_causes=common_failure_causes,
            environmental_factors=environmental_factors,
            timing_issues=timing_issues,
            recommendations=recommendations
        )
    
    def _identify_failure_causes(self, test_runs: List[Dict]) -> List[str]:
        """Identify common failure causes"""
        causes = []
        
        # Analyze error messages
        error_messages = [run.get('error_message', '') for run in test_runs if run.get('status') == 'failed']
        if error_messages:
            error_keywords = []
            for error in error_messages:
                if 'timeout' in error.lower():
                    error_keywords.append('Timeout issues')
                elif 'connection' in error.lower():
                    error_keywords.append('Connection problems')
                elif 'assertion' in error.lower():
                    error_keywords.append('Assertion failures')
                elif 'element not found' in error.lower():
                    error_keywords.append('Element not found')
                elif 'permission' in error.lower():
                    error_keywords.append('Permission issues')
            
            if error_keywords:
                causes.extend(list(set(error_keywords)))
        
        return causes
    
    def _identify_environmental_factors(self, test_runs: List[Dict]) -> List[str]:
        """Identify environmental factors affecting test reliability"""
        factors = []
        
        # Check for environment-specific failures
        environments = [run.get('environment', 'unknown') for run in test_runs]
        env_counts = Counter(environments)
        
        if len(env_counts) > 1:
            for env, count in env_counts.items():
                failed_in_env = sum(1 for run in test_runs 
                                  if run.get('environment') == env and run.get('status') == 'failed')
                if failed_in_env > count * 0.5:  # More than 50% failure rate in this environment
                    factors.append(f"High failure rate in {env} environment")
        
        # Check for browser-specific issues
        browsers = [run.get('browser', 'unknown') for run in test_runs]
        browser_counts = Counter(browsers)
        
        if len(browser_counts) > 1:
            for browser, count in browser_counts.items():
                failed_in_browser = sum(1 for run in test_runs 
                                      if run.get('browser') == browser and run.get('status') == 'failed')
                if failed_in_browser > count * 0.5:
                    factors.append(f"High failure rate in {browser} browser")
        
        return factors
    
    def _identify_timing_issues(self, test_runs: List[Dict]) -> List[str]:
        """Identify timing-related issues"""
        issues = []
        
        # Analyze duration patterns
        durations = [run.get('duration', 0) for run in test_runs]
        if durations:
            avg_duration = statistics.mean(durations)
            std_duration = statistics.stdev(durations) if len(durations) > 1 else 0
            
            # High variance in duration
            if std_duration > avg_duration * 0.5:
                issues.append("High variance in test execution time")
            
            # Very long durations
            if avg_duration > 60:
                issues.append("Tests taking too long to execute")
            
            # Timeout-related failures
            timeout_failures = sum(1 for run in test_runs 
                                 if run.get('status') == 'failed' and 'timeout' in run.get('error_message', '').lower())
            if timeout_failures > len(test_runs) * 0.2:
                issues.append("Frequent timeout failures")
        
        return issues
    
    def _generate_recommendations(self, metrics: TestReliabilityMetrics, 
                                failure_causes: List[str], environmental_factors: List[str], 
                                timing_issues: List[str]) -> List[str]:
        """Generate recommendations for improving test reliability"""
        recommendations = []
        
        # General recommendations based on metrics
        if metrics.success_rate < 80:
            recommendations.append("Consider refactoring the test to improve success rate")
        
        if metrics.flakiness_score > 20:
            recommendations.append("Add retry logic for flaky test steps")
            recommendations.append("Increase wait times for dynamic elements")
        
        if metrics.duration_variance > 100:
            recommendations.append("Optimize test execution time consistency")
            recommendations.append("Add explicit waits instead of fixed delays")
        
        # Specific recommendations based on failure causes
        if 'Timeout issues' in failure_causes:
            recommendations.append("Increase timeout values for slow operations")
            recommendations.append("Add explicit waits for elements to be ready")
        
        if 'Connection problems' in failure_causes:
            recommendations.append("Add retry logic for network operations")
            recommendations.append("Implement connection pooling")
        
        if 'Element not found' in failure_causes:
            recommendations.append("Use more robust element selectors")
            recommendations.append("Add explicit waits for elements to appear")
        
        # Environmental recommendations
        if environmental_factors:
            recommendations.append("Standardize test environment configuration")
            recommendations.append("Add environment-specific test configurations")
        
        # Timing recommendations
        if timing_issues:
            recommendations.append("Optimize test execution speed")
            recommendations.append("Use parallel execution where possible")
            recommendations.append("Implement smart wait strategies")
        
        return recommendations

class TestStabilizer:
    """System for stabilizing flaky tests"""
    
    def __init__(self, analyzer: TestReliabilityAnalyzer):
        self.analyzer = analyzer
        self.stabilization_strategies = {}
        
    def generate_stabilization_plan(self, test_id: str) -> Dict[str, Any]:
        """Generate a plan to stabilize a flaky test"""
        logger.info(f"Generating stabilization plan for test: {test_id}")
        
        if test_id not in self.analyzer.reliability_metrics:
            self.analyzer.analyze_test_reliability(test_id)
        
        metrics = self.analyzer.reliability_metrics[test_id]
        test_runs = [run for run in self.analyzer.test_history if run.get('test_id') == test_id]
        
        plan = {
            'test_id': test_id,
            'current_reliability_score': metrics.reliability_score,
            'target_reliability_score': 95.0,
            'stabilization_strategies': [],
            'implementation_steps': [],
            'expected_improvement': 0.0
        }
        
        # Generate strategies based on analysis
        strategies = []
        
        # Retry strategy
        if metrics.flakiness_score > 10:
            strategies.append({
                'strategy': 'retry_logic',
                'description': 'Add retry logic for flaky operations',
                'implementation': 'Implement exponential backoff retry for failed steps',
                'expected_improvement': min(metrics.flakiness_score * 0.5, 20)
            })
        
        # Wait strategy
        if metrics.duration_variance > 50:
            strategies.append({
                'strategy': 'smart_waits',
                'description': 'Replace fixed delays with smart waits',
                'implementation': 'Use explicit waits for elements and conditions',
                'expected_improvement': 15
            })
        
        # Environment strategy
        if any('environment' in str(run) for run in test_runs):
            strategies.append({
                'strategy': 'environment_stabilization',
                'description': 'Stabilize test environment',
                'implementation': 'Standardize environment configuration and cleanup',
                'expected_improvement': 10
            })
        
        # Data strategy
        if metrics.success_rate < 90:
            strategies.append({
                'strategy': 'test_data_management',
                'description': 'Improve test data setup and cleanup',
                'implementation': 'Implement proper test data isolation and cleanup',
                'expected_improvement': 20
            })
        
        plan['stabilization_strategies'] = strategies
        
        # Generate implementation steps
        implementation_steps = []
        for i, strategy in enumerate(strategies, 1):
            implementation_steps.extend([
                f"Step {i}.1: Analyze current {strategy['strategy']} implementation",
                f"Step {i}.2: Design improved {strategy['strategy']} approach",
                f"Step {i}.3: Implement {strategy['strategy']} changes",
                f"Step {i}.4: Test and validate {strategy['strategy']} improvements"
            ])
        
        plan['implementation_steps'] = implementation_steps
        
        # Calculate expected improvement
        total_improvement = sum(strategy['expected_improvement'] for strategy in strategies)
        plan['expected_improvement'] = min(total_improvement, 100 - metrics.reliability_score)
        
        self.stabilization_strategies[test_id] = plan
        logger.info(f"Stabilization plan generated for {test_id}: {plan['expected_improvement']:.1f}% expected improvement")
        
        return plan
    
    def apply_stabilization_strategies(self, test_id: str) -> Dict[str, Any]:
        """Apply stabilization strategies to a test"""
        logger.info(f"Applying stabilization strategies for test: {test_id}")
        
        if test_id not in self.stabilization_strategies:
            self.generate_stabilization_plan(test_id)
        
        plan = self.stabilization_strategies[test_id]
        results = {
            'test_id': test_id,
            'strategies_applied': [],
            'improvements_made': [],
            'new_reliability_score': 0.0,
            'improvement_achieved': 0.0
        }
        
        # Simulate applying strategies (in real implementation, this would modify actual test code)
        for strategy in plan['stabilization_strategies']:
            strategy_name = strategy['strategy']
            results['strategies_applied'].append(strategy_name)
            
            # Simulate improvement
            improvement = strategy['expected_improvement'] * np.random.uniform(0.7, 1.0)
            results['improvements_made'].append({
                'strategy': strategy_name,
                'improvement': improvement,
                'description': strategy['description']
            })
        
        # Calculate new reliability score
        current_score = plan['current_reliability_score']
        total_improvement = sum(imp['improvement'] for imp in results['improvements_made'])
        new_score = min(current_score + total_improvement, 100)
        
        results['new_reliability_score'] = new_score
        results['improvement_achieved'] = new_score - current_score
        
        logger.info(f"Stabilization applied to {test_id}: {results['improvement_achieved']:.1f}% improvement")
        return results

def generate_sample_test_history() -> List[Dict]:
    """Generate sample test execution history"""
    logger.info("Generating sample test execution history...")
    
    test_ids = [f'test_{i}' for i in range(50)]
    history = []
    
    for test_id in test_ids:
        # Generate 20-100 runs per test
        num_runs = np.random.randint(20, 100)
        
        for run in range(num_runs):
            # Simulate different reliability levels
            if 'test_0' in test_id or 'test_1' in test_id:
                # Very reliable tests
                status = np.random.choice(['passed', 'failed'], p=[0.98, 0.02])
            elif 'test_2' in test_id or 'test_3' in test_id:
                # Flaky tests
                status = np.random.choice(['passed', 'failed'], p=[0.7, 0.3])
            else:
                # Normal tests
                status = np.random.choice(['passed', 'failed'], p=[0.9, 0.1])
            
            # Generate error message for failures
            error_message = ""
            if status == 'failed':
                error_messages = [
                    "Element not found: button.submit",
                    "Timeout waiting for element",
                    "Connection refused",
                    "Assertion failed: expected 'success' but got 'error'",
                    "Permission denied"
                ]
                error_message = np.random.choice(error_messages)
            
            # Generate duration with some variance
            base_duration = np.random.exponential(5)
            if status == 'failed':
                base_duration *= np.random.uniform(1.5, 3.0)  # Failed tests often take longer
            
            history.append({
                'test_id': test_id,
                'status': status,
                'duration': base_duration,
                'timestamp': (datetime.now() - timedelta(days=np.random.randint(0, 30))).isoformat(),
                'environment': np.random.choice(['staging', 'production', 'development']),
                'browser': np.random.choice(['chrome', 'firefox', 'safari']),
                'error_message': error_message
            })
    
    logger.info(f"Generated {len(history)} test execution records")
    return history

def main():
    """Main function to demonstrate test reliability improvement"""
    logger.info("🛡️ Starting Test Reliability Improver")
    
    # Generate sample data
    sample_history = generate_sample_test_history()
    
    # Save sample data
    history_file = RELIABILITY_DIR / "test_history.json"
    with open(history_file, 'w') as f:
        json.dump(sample_history, f, indent=2)
    
    # Initialize analyzer
    analyzer = TestReliabilityAnalyzer()
    analyzer.load_test_history(history_file)
    
    # Analyze reliability for all tests
    test_ids = list(set(run['test_id'] for run in sample_history))
    logger.info(f"Analyzing reliability for {len(test_ids)} tests...")
    
    for test_id in test_ids:
        analyzer.analyze_test_reliability(test_id)
    
    # Identify flaky tests
    flaky_tests = analyzer.identify_flaky_tests(threshold=10.0)
    
    logger.info(f"Found {len(flaky_tests)} flaky tests:")
    for test in flaky_tests[:5]:  # Show top 5
        logger.info(f"  {test.test_id}: {test.flakiness_score:.1f}% flakiness ({test.flakiness_level})")
    
    # Generate stabilization plans for flaky tests
    stabilizer = TestStabilizer(analyzer)
    
    logger.info("Generating stabilization plans...")
    for test in flaky_tests[:3]:  # Generate plans for top 3 flaky tests
        plan = stabilizer.generate_stabilization_plan(test.test_id)
        logger.info(f"Plan for {test.test_id}: {plan['expected_improvement']:.1f}% expected improvement")
        
        # Apply stabilization strategies
        results = stabilizer.apply_stabilization_strategies(test.test_id)
        logger.info(f"Applied stabilization to {test.test_id}: {results['improvement_achieved']:.1f}% improvement achieved")
    
    # Save analysis results
    analysis_results = {
        'total_tests': len(test_ids),
        'flaky_tests': len(flaky_tests),
        'reliability_metrics': {test_id: asdict(metrics) for test_id, metrics in analyzer.reliability_metrics.items()},
        'flakiness_analysis': [asdict(test) for test in flaky_tests],
        'stabilization_plans': list(stabilizer.stabilization_strategies.values())
    }
    
    results_file = ANALYSIS_DIR / f"reliability_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump(analysis_results, f, indent=2, default=str)
    
    logger.info(f"Analysis results saved to: {results_file}")
    logger.info("🎉 Test Reliability Improver demonstration completed")

if __name__ == "__main__":
    main()
