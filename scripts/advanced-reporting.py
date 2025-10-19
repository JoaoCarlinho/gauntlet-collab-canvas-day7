#!/usr/bin/env python3

"""
📊 CollabCanvas Advanced Reporting System
Comprehensive reporting and analytics for test results and system performance
"""

import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import plotly.offline as pyo
from jinja2 import Template
import base64
from io import BytesIO

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
REPORTS_DIR = PROJECT_ROOT / "advanced-reports"
DATA_DIR = PROJECT_ROOT / "test-data"
TEMPLATES_DIR = PROJECT_ROOT / "report-templates"
LOG_DIR = PROJECT_ROOT / "logs"

# Create directories
REPORTS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'advanced-reporting.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TestMetrics:
    """Test execution metrics"""
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    error_tests: int
    execution_time: float
    success_rate: float
    failure_rate: float
    average_duration: float
    median_duration: float
    p95_duration: float
    p99_duration: float

@dataclass
class PerformanceMetrics:
    """Performance metrics"""
    response_time_avg: float
    response_time_p95: float
    response_time_p99: float
    throughput: float
    error_rate: float
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: float

@dataclass
class TrendData:
    """Trend analysis data"""
    date: datetime
    metric_value: float
    metric_type: str
    category: str

class AdvancedReportingEngine:
    """Advanced reporting and analytics engine"""
    
    def __init__(self):
        self.test_data = []
        self.performance_data = []
        self.trend_data = []
        self.report_templates = {}
        
    def load_test_data(self, data_file: Path) -> None:
        """Load test execution data"""
        logger.info(f"Loading test data from: {data_file}")
        
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        self.test_data.extend(data)
        logger.info(f"Loaded {len(data)} test records")
    
    def load_performance_data(self, data_file: Path) -> None:
        """Load performance monitoring data"""
        logger.info(f"Loading performance data from: {data_file}")
        
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        self.performance_data.extend(data)
        logger.info(f"Loaded {len(data)} performance records")
    
    def generate_test_metrics(self, time_range: Optional[Tuple[datetime, datetime]] = None) -> TestMetrics:
        """Generate comprehensive test metrics"""
        logger.info("Generating test metrics...")
        
        # Filter data by time range if specified
        filtered_data = self._filter_data_by_time(self.test_data, time_range)
        
        if not filtered_data:
            logger.warning("No test data available for the specified time range")
            return TestMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        
        # Calculate basic metrics
        total_tests = len(filtered_data)
        passed_tests = sum(1 for test in filtered_data if test.get('status') == 'passed')
        failed_tests = sum(1 for test in filtered_data if test.get('status') == 'failed')
        skipped_tests = sum(1 for test in filtered_data if test.get('status') == 'skipped')
        error_tests = sum(1 for test in filtered_data if test.get('status') == 'error')
        
        # Calculate rates
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        failure_rate = ((failed_tests + error_tests) / total_tests) * 100 if total_tests > 0 else 0
        
        # Calculate duration metrics
        durations = [test.get('duration', 0) for test in filtered_data if test.get('duration')]
        execution_time = sum(durations)
        
        if durations:
            average_duration = np.mean(durations)
            median_duration = np.median(durations)
            p95_duration = np.percentile(durations, 95)
            p99_duration = np.percentile(durations, 99)
        else:
            average_duration = median_duration = p95_duration = p99_duration = 0
        
        metrics = TestMetrics(
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            skipped_tests=skipped_tests,
            error_tests=error_tests,
            execution_time=execution_time,
            success_rate=success_rate,
            failure_rate=failure_rate,
            average_duration=average_duration,
            median_duration=median_duration,
            p95_duration=p95_duration,
            p99_duration=p99_duration
        )
        
        logger.info(f"Generated metrics: {total_tests} tests, {success_rate:.2f}% success rate")
        return metrics
    
    def generate_performance_metrics(self, time_range: Optional[Tuple[datetime, datetime]] = None) -> PerformanceMetrics:
        """Generate performance metrics"""
        logger.info("Generating performance metrics...")
        
        # Filter data by time range if specified
        filtered_data = self._filter_data_by_time(self.performance_data, time_range)
        
        if not filtered_data:
            logger.warning("No performance data available for the specified time range")
            return PerformanceMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0)
        
        # Calculate response time metrics
        response_times = [record.get('response_time', 0) for record in filtered_data if record.get('response_time')]
        
        if response_times:
            response_time_avg = np.mean(response_times)
            response_time_p95 = np.percentile(response_times, 95)
            response_time_p99 = np.percentile(response_times, 99)
        else:
            response_time_avg = response_time_p95 = response_time_p99 = 0
        
        # Calculate throughput
        total_requests = len(filtered_data)
        time_span = self._get_time_span(filtered_data)
        throughput = total_requests / time_span if time_span > 0 else 0
        
        # Calculate error rate
        error_count = sum(1 for record in filtered_data if record.get('status_code', 200) >= 400)
        error_rate = (error_count / total_requests) * 100 if total_requests > 0 else 0
        
        # Calculate resource usage
        cpu_usage = np.mean([record.get('cpu_usage', 0) for record in filtered_data if record.get('cpu_usage')])
        memory_usage = np.mean([record.get('memory_usage', 0) for record in filtered_data if record.get('memory_usage')])
        disk_usage = np.mean([record.get('disk_usage', 0) for record in filtered_data if record.get('disk_usage')])
        network_io = np.mean([record.get('network_io', 0) for record in filtered_data if record.get('network_io')])
        
        metrics = PerformanceMetrics(
            response_time_avg=response_time_avg,
            response_time_p95=response_time_p95,
            response_time_p99=response_time_p99,
            throughput=throughput,
            error_rate=error_rate,
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            disk_usage=disk_usage,
            network_io=network_io
        )
        
        logger.info(f"Generated performance metrics: {throughput:.2f} req/s, {error_rate:.2f}% error rate")
        return metrics
    
    def generate_trend_analysis(self, metric_type: str, days: int = 30) -> List[TrendData]:
        """Generate trend analysis for a specific metric"""
        logger.info(f"Generating trend analysis for {metric_type} over {days} days")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Filter data by time range
        filtered_data = self._filter_data_by_time(self.test_data, (start_date, end_date))
        
        # Group data by date
        daily_data = {}
        for record in filtered_data:
            date = datetime.fromisoformat(record.get('timestamp', datetime.now().isoformat())).date()
            if date not in daily_data:
                daily_data[date] = []
            daily_data[date].append(record)
        
        # Calculate daily metrics
        trend_data = []
        for date, records in daily_data.items():
            if metric_type == 'success_rate':
                total = len(records)
                passed = sum(1 for r in records if r.get('status') == 'passed')
                value = (passed / total) * 100 if total > 0 else 0
            elif metric_type == 'execution_time':
                value = sum(r.get('duration', 0) for r in records)
            elif metric_type == 'test_count':
                value = len(records)
            else:
                value = 0
            
            trend_data.append(TrendData(
                date=datetime.combine(date, datetime.min.time()),
                metric_value=value,
                metric_type=metric_type,
                category='daily'
            ))
        
        logger.info(f"Generated {len(trend_data)} trend data points")
        return trend_data
    
    def create_executive_dashboard(self) -> str:
        """Create an executive dashboard with key metrics"""
        logger.info("Creating executive dashboard...")
        
        # Generate metrics
        test_metrics = self.generate_test_metrics()
        performance_metrics = self.generate_performance_metrics()
        
        # Create dashboard HTML
        dashboard_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>CollabCanvas Executive Dashboard</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .dashboard {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
                .metric-card {{ background: #f5f5f5; padding: 20px; border-radius: 8px; }}
                .metric-title {{ font-size: 18px; font-weight: bold; margin-bottom: 10px; }}
                .metric-value {{ font-size: 32px; font-weight: bold; color: #2c3e50; }}
                .metric-subtitle {{ font-size: 14px; color: #7f8c8d; }}
                .status-good {{ color: #27ae60; }}
                .status-warning {{ color: #f39c12; }}
                .status-danger {{ color: #e74c3c; }}
            </style>
        </head>
        <body>
            <h1>CollabCanvas Executive Dashboard</h1>
            <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            
            <div class="dashboard">
                <div class="metric-card">
                    <div class="metric-title">Test Success Rate</div>
                    <div class="metric-value {'status-good' if test_metrics.success_rate >= 95 else 'status-warning' if test_metrics.success_rate >= 80 else 'status-danger'}">
                        {test_metrics.success_rate:.1f}%
                    </div>
                    <div class="metric-subtitle">{test_metrics.passed_tests} of {test_metrics.total_tests} tests passed</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Average Response Time</div>
                    <div class="metric-value {'status-good' if performance_metrics.response_time_avg < 1 else 'status-warning' if performance_metrics.response_time_avg < 2 else 'status-danger'}">
                        {performance_metrics.response_time_avg:.2f}s
                    </div>
                    <div class="metric-subtitle">95th percentile: {performance_metrics.response_time_p95:.2f}s</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">System Throughput</div>
                    <div class="metric-value {'status-good' if performance_metrics.throughput > 100 else 'status-warning' if performance_metrics.throughput > 50 else 'status-danger'}">
                        {performance_metrics.throughput:.1f} req/s
                    </div>
                    <div class="metric-subtitle">Requests per second</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Error Rate</div>
                    <div class="metric-value {'status-good' if performance_metrics.error_rate < 1 else 'status-warning' if performance_metrics.error_rate < 5 else 'status-danger'}">
                        {performance_metrics.error_rate:.2f}%
                    </div>
                    <div class="metric-subtitle">HTTP error rate</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Resource Usage</div>
                    <div class="metric-value">
                        CPU: {performance_metrics.cpu_usage:.1f}%
                    </div>
                    <div class="metric-subtitle">Memory: {performance_metrics.memory_usage:.1f}% | Disk: {performance_metrics.disk_usage:.1f}%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">Test Execution Time</div>
                    <div class="metric-value">
                        {test_metrics.execution_time:.1f}s
                    </div>
                    <div class="metric-subtitle">Average: {test_metrics.average_duration:.2f}s | Median: {test_metrics.median_duration:.2f}s</div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Save dashboard
        dashboard_file = REPORTS_DIR / f"executive_dashboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(dashboard_file, 'w') as f:
            f.write(dashboard_html)
        
        logger.info(f"Executive dashboard saved to: {dashboard_file}")
        return str(dashboard_file)
    
    def create_trend_charts(self) -> str:
        """Create trend analysis charts"""
        logger.info("Creating trend analysis charts...")
        
        # Generate trend data
        success_rate_trend = self.generate_trend_analysis('success_rate', 30)
        execution_time_trend = self.generate_trend_analysis('execution_time', 30)
        test_count_trend = self.generate_trend_analysis('test_count', 30)
        
        # Create subplots
        fig = make_subplots(
            rows=3, cols=1,
            subplot_titles=('Test Success Rate Trend', 'Test Execution Time Trend', 'Test Count Trend'),
            vertical_spacing=0.1
        )
        
        # Success rate trend
        if success_rate_trend:
            dates = [t.date for t in success_rate_trend]
            values = [t.metric_value for t in success_rate_trend]
            fig.add_trace(
                go.Scatter(x=dates, y=values, mode='lines+markers', name='Success Rate'),
                row=1, col=1
            )
        
        # Execution time trend
        if execution_time_trend:
            dates = [t.date for t in execution_time_trend]
            values = [t.metric_value for t in execution_time_trend]
            fig.add_trace(
                go.Scatter(x=dates, y=values, mode='lines+markers', name='Execution Time'),
                row=2, col=1
            )
        
        # Test count trend
        if test_count_trend:
            dates = [t.date for t in test_count_trend]
            values = [t.metric_value for t in test_count_trend]
            fig.add_trace(
                go.Scatter(x=dates, y=values, mode='lines+markers', name='Test Count'),
                row=3, col=1
            )
        
        # Update layout
        fig.update_layout(
            height=900,
            title_text="CollabCanvas Test Trends (Last 30 Days)",
            showlegend=False
        )
        
        # Save chart
        chart_file = REPORTS_DIR / f"trend_charts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        pyo.plot(fig, filename=str(chart_file), auto_open=False)
        
        logger.info(f"Trend charts saved to: {chart_file}")
        return str(chart_file)
    
    def create_performance_report(self) -> str:
        """Create detailed performance report"""
        logger.info("Creating performance report...")
        
        # Generate performance metrics
        perf_metrics = self.generate_performance_metrics()
        
        # Create performance report HTML
        report_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>CollabCanvas Performance Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .report-section {{ margin-bottom: 30px; }}
                .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }}
                .metric-item {{ background: #f8f9fa; padding: 15px; border-radius: 5px; }}
                .metric-label {{ font-weight: bold; color: #495057; }}
                .metric-value {{ font-size: 24px; color: #212529; margin-top: 5px; }}
                .performance-chart {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <h1>CollabCanvas Performance Report</h1>
            <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            
            <div class="report-section">
                <h2>Response Time Metrics</h2>
                <div class="metric-grid">
                    <div class="metric-item">
                        <div class="metric-label">Average Response Time</div>
                        <div class="metric-value">{perf_metrics.response_time_avg:.3f}s</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">95th Percentile</div>
                        <div class="metric-value">{perf_metrics.response_time_p95:.3f}s</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">99th Percentile</div>
                        <div class="metric-value">{perf_metrics.response_time_p99:.3f}s</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h2>Throughput Metrics</h2>
                <div class="metric-grid">
                    <div class="metric-item">
                        <div class="metric-label">Requests per Second</div>
                        <div class="metric-value">{perf_metrics.throughput:.2f}</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Error Rate</div>
                        <div class="metric-value">{perf_metrics.error_rate:.2f}%</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h2>Resource Utilization</h2>
                <div class="metric-grid">
                    <div class="metric-item">
                        <div class="metric-label">CPU Usage</div>
                        <div class="metric-value">{perf_metrics.cpu_usage:.1f}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Memory Usage</div>
                        <div class="metric-value">{perf_metrics.memory_usage:.1f}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Disk Usage</div>
                        <div class="metric-value">{perf_metrics.disk_usage:.1f}%</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Network I/O</div>
                        <div class="metric-value">{perf_metrics.network_io:.2f} MB/s</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Save report
        report_file = REPORTS_DIR / f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(report_file, 'w') as f:
            f.write(report_html)
        
        logger.info(f"Performance report saved to: {report_file}")
        return str(report_file)
    
    def create_comprehensive_report(self) -> str:
        """Create a comprehensive report with all metrics and charts"""
        logger.info("Creating comprehensive report...")
        
        # Generate all metrics
        test_metrics = self.generate_test_metrics()
        perf_metrics = self.generate_performance_metrics()
        
        # Create comprehensive report
        report_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>CollabCanvas Comprehensive Test Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
                .header {{ background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
                .section {{ margin-bottom: 40px; }}
                .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
                .metric-card {{ background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }}
                .metric-title {{ font-size: 14px; color: #6c757d; text-transform: uppercase; }}
                .metric-value {{ font-size: 28px; font-weight: bold; color: #212529; margin: 10px 0; }}
                .metric-description {{ font-size: 12px; color: #6c757d; }}
                .status-good {{ border-left-color: #28a745; }}
                .status-warning {{ border-left-color: #ffc107; }}
                .status-danger {{ border-left-color: #dc3545; }}
                .chart-container {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>CollabCanvas Comprehensive Test Report</h1>
                <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p>Report Period: Last 30 days</p>
            </div>
            
            <div class="section">
                <h2>Test Execution Summary</h2>
                <div class="metric-grid">
                    <div class="metric-card {'status-good' if test_metrics.success_rate >= 95 else 'status-warning' if test_metrics.success_rate >= 80 else 'status-danger'}">
                        <div class="metric-title">Success Rate</div>
                        <div class="metric-value">{test_metrics.success_rate:.1f}%</div>
                        <div class="metric-description">{test_metrics.passed_tests} of {test_metrics.total_tests} tests passed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Total Tests</div>
                        <div class="metric-value">{test_metrics.total_tests}</div>
                        <div class="metric-description">Tests executed</div>
                    </div>
                    <div class="metric-card {'status-danger' if test_metrics.failed_tests > 0 else 'status-good'}">
                        <div class="metric-title">Failed Tests</div>
                        <div class="metric-value">{test_metrics.failed_tests}</div>
                        <div class="metric-description">Tests that failed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Execution Time</div>
                        <div class="metric-value">{test_metrics.execution_time:.1f}s</div>
                        <div class="metric-description">Total execution time</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Performance Metrics</h2>
                <div class="metric-grid">
                    <div class="metric-card {'status-good' if perf_metrics.response_time_avg < 1 else 'status-warning' if perf_metrics.response_time_avg < 2 else 'status-danger'}">
                        <div class="metric-title">Avg Response Time</div>
                        <div class="metric-value">{perf_metrics.response_time_avg:.3f}s</div>
                        <div class="metric-description">Average API response time</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">95th Percentile</div>
                        <div class="metric-value">{perf_metrics.response_time_p95:.3f}s</div>
                        <div class="metric-description">95th percentile response time</div>
                    </div>
                    <div class="metric-card {'status-good' if perf_metrics.throughput > 100 else 'status-warning' if perf_metrics.throughput > 50 else 'status-danger'}">
                        <div class="metric-title">Throughput</div>
                        <div class="metric-value">{perf_metrics.throughput:.1f} req/s</div>
                        <div class="metric-description">Requests per second</div>
                    </div>
                    <div class="metric-card {'status-good' if perf_metrics.error_rate < 1 else 'status-warning' if perf_metrics.error_rate < 5 else 'status-danger'}">
                        <div class="metric-title">Error Rate</div>
                        <div class="metric-value">{perf_metrics.error_rate:.2f}%</div>
                        <div class="metric-description">HTTP error rate</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Resource Utilization</h2>
                <div class="metric-grid">
                    <div class="metric-card {'status-good' if perf_metrics.cpu_usage < 70 else 'status-warning' if perf_metrics.cpu_usage < 90 else 'status-danger'}">
                        <div class="metric-title">CPU Usage</div>
                        <div class="metric-value">{perf_metrics.cpu_usage:.1f}%</div>
                        <div class="metric-description">Average CPU utilization</div>
                    </div>
                    <div class="metric-card {'status-good' if perf_metrics.memory_usage < 70 else 'status-warning' if perf_metrics.memory_usage < 90 else 'status-danger'}">
                        <div class="metric-title">Memory Usage</div>
                        <div class="metric-value">{perf_metrics.memory_usage:.1f}%</div>
                        <div class="metric-description">Average memory utilization</div>
                    </div>
                    <div class="metric-card {'status-good' if perf_metrics.disk_usage < 80 else 'status-warning' if perf_metrics.disk_usage < 95 else 'status-danger'}">
                        <div class="metric-title">Disk Usage</div>
                        <div class="metric-value">{perf_metrics.disk_usage:.1f}%</div>
                        <div class="metric-description">Average disk utilization</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Network I/O</div>
                        <div class="metric-value">{perf_metrics.network_io:.2f} MB/s</div>
                        <div class="metric-description">Average network throughput</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Test Duration Analysis</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-title">Average Duration</div>
                        <div class="metric-value">{test_metrics.average_duration:.2f}s</div>
                        <div class="metric-description">Average test execution time</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Median Duration</div>
                        <div class="metric-value">{test_metrics.median_duration:.2f}s</div>
                        <div class="metric-description">Median test execution time</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">95th Percentile</div>
                        <div class="metric-value">{test_metrics.p95_duration:.2f}s</div>
                        <div class="metric-description">95th percentile duration</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">99th Percentile</div>
                        <div class="metric-value">{test_metrics.p99_duration:.2f}s</div>
                        <div class="metric-description">99th percentile duration</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Save comprehensive report
        report_file = REPORTS_DIR / f"comprehensive_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(report_file, 'w') as f:
            f.write(report_html)
        
        logger.info(f"Comprehensive report saved to: {report_file}")
        return str(report_file)
    
    def _filter_data_by_time(self, data: List[Dict], time_range: Optional[Tuple[datetime, datetime]]) -> List[Dict]:
        """Filter data by time range"""
        if not time_range:
            return data
        
        start_time, end_time = time_range
        filtered_data = []
        
        for record in data:
            timestamp_str = record.get('timestamp', '')
            if timestamp_str:
                try:
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    if start_time <= timestamp <= end_time:
                        filtered_data.append(record)
                except ValueError:
                    continue
        
        return filtered_data
    
    def _get_time_span(self, data: List[Dict]) -> float:
        """Get time span in seconds for throughput calculation"""
        if not data:
            return 0
        
        timestamps = []
        for record in data:
            timestamp_str = record.get('timestamp', '')
            if timestamp_str:
                try:
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    timestamps.append(timestamp)
                except ValueError:
                    continue
        
        if len(timestamps) < 2:
            return 1  # Default to 1 second if we can't calculate
        
        return (max(timestamps) - min(timestamps)).total_seconds()

def generate_sample_data() -> None:
    """Generate sample data for demonstration"""
    logger.info("Generating sample test and performance data...")
    
    # Generate sample test data
    test_data = []
    for i in range(1000):
        test_data.append({
            'test_id': f'test_{i}',
            'status': np.random.choice(['passed', 'failed', 'skipped', 'error'], p=[0.85, 0.10, 0.03, 0.02]),
            'duration': np.random.exponential(5),
            'timestamp': (datetime.now() - timedelta(days=np.random.randint(0, 30))).isoformat(),
            'test_type': np.random.choice(['unit', 'integration', 'e2e']),
            'category': np.random.choice(['auth', 'canvas', 'collaboration', 'ai'])
        })
    
    # Save test data
    test_data_file = DATA_DIR / "test_data.json"
    with open(test_data_file, 'w') as f:
        json.dump(test_data, f, indent=2)
    
    # Generate sample performance data
    performance_data = []
    for i in range(5000):
        performance_data.append({
            'timestamp': (datetime.now() - timedelta(hours=np.random.randint(0, 720))).isoformat(),
            'response_time': np.random.exponential(0.5),
            'status_code': np.random.choice([200, 201, 400, 401, 500], p=[0.7, 0.15, 0.05, 0.05, 0.05]),
            'cpu_usage': np.random.uniform(20, 80),
            'memory_usage': np.random.uniform(30, 70),
            'disk_usage': np.random.uniform(40, 90),
            'network_io': np.random.uniform(0.1, 10.0)
        })
    
    # Save performance data
    performance_data_file = DATA_DIR / "performance_data.json"
    with open(performance_data_file, 'w') as f:
        json.dump(performance_data, f, indent=2)
    
    logger.info(f"Generated sample data: {len(test_data)} test records, {len(performance_data)} performance records")

def main():
    """Main function to demonstrate advanced reporting"""
    logger.info("📊 Starting Advanced Reporting System")
    
    # Generate sample data
    generate_sample_data()
    
    # Initialize reporting engine
    engine = AdvancedReportingEngine()
    
    # Load sample data
    engine.load_test_data(DATA_DIR / "test_data.json")
    engine.load_performance_data(DATA_DIR / "performance_data.json")
    
    # Generate reports
    try:
        # Executive dashboard
        dashboard_file = engine.create_executive_dashboard()
        logger.info(f"Executive dashboard created: {dashboard_file}")
        
        # Trend charts
        charts_file = engine.create_trend_charts()
        logger.info(f"Trend charts created: {charts_file}")
        
        # Performance report
        perf_report_file = engine.create_performance_report()
        logger.info(f"Performance report created: {perf_report_file}")
        
        # Comprehensive report
        comprehensive_file = engine.create_comprehensive_report()
        logger.info(f"Comprehensive report created: {comprehensive_file}")
        
    except Exception as e:
        logger.error(f"Error generating reports: {e}")
    
    logger.info("🎉 Advanced Reporting demonstration completed")

if __name__ == "__main__":
    main()
