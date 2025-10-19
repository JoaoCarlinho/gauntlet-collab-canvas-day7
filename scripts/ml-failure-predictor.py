#!/usr/bin/env python3

"""
🤖 CollabCanvas ML Failure Predictor
Machine learning system for predicting test failures and optimizing test execution
"""

import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import logging
from typing import Dict, List, Tuple, Optional
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import warnings
warnings.filterwarnings('ignore')

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "ml-data"
MODELS_DIR = PROJECT_ROOT / "ml-models"
LOG_DIR = PROJECT_ROOT / "logs"

# Create directories
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'ml-failure-predictor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TestFailurePredictor:
    """Machine Learning model for predicting test failures"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_columns = []
        self.model_path = MODELS_DIR / "failure_predictor_model.pkl"
        self.scaler_path = MODELS_DIR / "failure_predictor_scaler.pkl"
        self.encoders_path = MODELS_DIR / "failure_predictor_encoders.pkl"
        
    def extract_features(self, test_data: Dict) -> Dict:
        """Extract features from test data for ML model"""
        features = {}
        
        # Test metadata features
        features['test_duration'] = test_data.get('duration', 0)
        features['test_size'] = len(test_data.get('code', ''))
        features['test_complexity'] = test_data.get('complexity_score', 0)
        
        # Historical features
        features['historical_failure_rate'] = test_data.get('historical_failure_rate', 0)
        features['recent_failures'] = test_data.get('recent_failures', 0)
        features['days_since_last_failure'] = test_data.get('days_since_last_failure', 999)
        
        # Code change features
        features['lines_changed'] = test_data.get('lines_changed', 0)
        features['files_changed'] = test_data.get('files_changed', 0)
        features['commit_frequency'] = test_data.get('commit_frequency', 0)
        
        # Environment features
        features['time_of_day'] = datetime.now().hour
        features['day_of_week'] = datetime.now().weekday()
        features['cpu_usage'] = test_data.get('cpu_usage', 0)
        features['memory_usage'] = test_data.get('memory_usage', 0)
        
        # Test type features
        features['is_integration_test'] = 1 if test_data.get('test_type') == 'integration' else 0
        features['is_unit_test'] = 1 if test_data.get('test_type') == 'unit' else 0
        features['is_e2e_test'] = 1 if test_data.get('test_type') == 'e2e' else 0
        
        # Dependency features
        features['dependency_count'] = test_data.get('dependency_count', 0)
        features['external_api_calls'] = test_data.get('external_api_calls', 0)
        
        return features
    
    def prepare_training_data(self, historical_data: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data from historical test results"""
        logger.info(f"Preparing training data from {len(historical_data)} records")
        
        features_list = []
        labels = []
        
        for record in historical_data:
            features = self.extract_features(record)
            features_list.append(features)
            labels.append(1 if record.get('failed', False) else 0)
        
        # Convert to DataFrame for easier handling
        df = pd.DataFrame(features_list)
        self.feature_columns = df.columns.tolist()
        
        # Handle missing values
        df = df.fillna(0)
        
        # Convert to numpy arrays
        X = df.values
        y = np.array(labels)
        
        logger.info(f"Training data shape: {X.shape}, Labels shape: {y.shape}")
        return X, y
    
    def train_model(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the failure prediction model"""
        logger.info("Training failure prediction model...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train multiple models and select the best one
        models = {
            'RandomForest': RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                class_weight='balanced'
            ),
            'GradientBoosting': GradientBoostingClassifier(
                n_estimators=100,
                max_depth=6,
                random_state=42
            )
        }
        
        best_model = None
        best_score = 0
        
        for name, model in models.items():
            logger.info(f"Training {name} model...")
            
            # Cross-validation
            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5)
            mean_score = cv_scores.mean()
            
            logger.info(f"{name} CV Score: {mean_score:.4f} (+/- {cv_scores.std() * 2:.4f})")
            
            if mean_score > best_score:
                best_score = mean_score
                best_model = model
        
        # Train the best model
        self.model = best_model
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate on test set
        y_pred = self.model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        logger.info(f"Best model accuracy: {accuracy:.4f}")
        logger.info("Classification Report:")
        logger.info(classification_report(y_test, y_pred))
        
        # Save model and scaler
        self.save_model()
    
    def predict_failure(self, test_data: Dict) -> Tuple[float, str]:
        """Predict the probability of test failure"""
        if self.model is None:
            self.load_model()
        
        if self.model is None:
            logger.warning("No trained model available, returning default prediction")
            return 0.5, "No model available"
        
        # Extract features
        features = self.extract_features(test_data)
        
        # Convert to DataFrame and handle missing values
        df = pd.DataFrame([features])
        df = df.reindex(columns=self.feature_columns, fill_value=0)
        
        # Scale features
        X_scaled = self.scaler.transform(df.values)
        
        # Predict probability
        failure_probability = self.model.predict_proba(X_scaled)[0][1]
        
        # Determine confidence level
        if failure_probability > 0.8:
            confidence = "High"
        elif failure_probability > 0.6:
            confidence = "Medium"
        else:
            confidence = "Low"
        
        return failure_probability, confidence
    
    def save_model(self) -> None:
        """Save the trained model and preprocessing objects"""
        logger.info("Saving model and preprocessing objects...")
        
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        joblib.dump(self.label_encoders, self.encoders_path)
        
        # Save feature columns
        with open(MODELS_DIR / "feature_columns.json", 'w') as f:
            json.dump(self.feature_columns, f)
        
        logger.info("Model saved successfully")
    
    def load_model(self) -> bool:
        """Load the trained model and preprocessing objects"""
        try:
            if not self.model_path.exists():
                logger.warning("No trained model found")
                return False
            
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.label_encoders = joblib.load(self.encoders_path)
            
            # Load feature columns
            with open(MODELS_DIR / "feature_columns.json", 'r') as f:
                self.feature_columns = json.load(f)
            
            logger.info("Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def generate_insights(self, test_data: Dict) -> Dict:
        """Generate insights about test failure risk"""
        failure_prob, confidence = self.predict_failure(test_data)
        
        insights = {
            'failure_probability': failure_prob,
            'confidence': confidence,
            'risk_level': self._get_risk_level(failure_prob),
            'recommendations': self._get_recommendations(test_data, failure_prob),
            'key_factors': self._get_key_factors(test_data)
        }
        
        return insights
    
    def _get_risk_level(self, probability: float) -> str:
        """Determine risk level based on failure probability"""
        if probability > 0.8:
            return "Critical"
        elif probability > 0.6:
            return "High"
        elif probability > 0.4:
            return "Medium"
        else:
            return "Low"
    
    def _get_recommendations(self, test_data: Dict, probability: float) -> List[str]:
        """Generate recommendations based on test data and failure probability"""
        recommendations = []
        
        if probability > 0.7:
            recommendations.append("Consider running this test in isolation first")
            recommendations.append("Review recent code changes that might affect this test")
            recommendations.append("Check for flaky test patterns")
        
        if test_data.get('historical_failure_rate', 0) > 0.3:
            recommendations.append("This test has a high historical failure rate - consider refactoring")
        
        if test_data.get('test_duration', 0) > 30:
            recommendations.append("Test duration is high - consider optimization")
        
        if test_data.get('dependency_count', 0) > 10:
            recommendations.append("High dependency count - consider reducing dependencies")
        
        return recommendations
    
    def _get_key_factors(self, test_data: Dict) -> List[str]:
        """Identify key factors contributing to failure risk"""
        factors = []
        
        if test_data.get('recent_failures', 0) > 0:
            factors.append("Recent failures in similar tests")
        
        if test_data.get('lines_changed', 0) > 100:
            factors.append("Large number of code changes")
        
        if test_data.get('is_integration_test', False):
            factors.append("Integration test complexity")
        
        if test_data.get('external_api_calls', 0) > 0:
            factors.append("External API dependencies")
        
        return factors

class IntelligentTestSelector:
    """Intelligent test selection based on ML predictions and code changes"""
    
    def __init__(self, predictor: TestFailurePredictor):
        self.predictor = predictor
        self.test_registry = {}
        self.change_impact_analyzer = ChangeImpactAnalyzer()
    
    def register_test(self, test_id: str, test_metadata: Dict) -> None:
        """Register a test with its metadata"""
        self.test_registry[test_id] = test_metadata
        logger.info(f"Registered test: {test_id}")
    
    def select_tests(self, code_changes: Dict, max_tests: int = 50) -> List[str]:
        """Select tests to run based on code changes and ML predictions"""
        logger.info(f"Selecting tests for {len(code_changes.get('files', []))} changed files")
        
        # Analyze change impact
        impacted_tests = self.change_impact_analyzer.analyze_impact(code_changes)
        
        # Score tests based on impact and failure probability
        test_scores = {}
        
        for test_id in impacted_tests:
            if test_id in self.test_registry:
                test_metadata = self.test_registry[test_id]
                
                # Get failure prediction
                failure_prob, _ = self.predictor.predict_failure(test_metadata)
                
                # Calculate impact score
                impact_score = self._calculate_impact_score(test_id, code_changes)
                
                # Combine scores
                total_score = (impact_score * 0.7) + (failure_prob * 0.3)
                test_scores[test_id] = total_score
        
        # Sort by score and select top tests
        selected_tests = sorted(test_scores.items(), key=lambda x: x[1], reverse=True)[:max_tests]
        
        logger.info(f"Selected {len(selected_tests)} tests for execution")
        return [test_id for test_id, _ in selected_tests]
    
    def _calculate_impact_score(self, test_id: str, code_changes: Dict) -> float:
        """Calculate the impact score for a test based on code changes"""
        # This is a simplified implementation
        # In a real system, this would analyze test dependencies, code coverage, etc.
        
        test_metadata = self.test_registry.get(test_id, {})
        changed_files = code_changes.get('files', [])
        
        # Check if test files are directly changed
        if test_id in changed_files:
            return 1.0
        
        # Check for indirect impacts (simplified)
        impact_score = 0.0
        for changed_file in changed_files:
            if self._is_related(test_id, changed_file):
                impact_score += 0.3
        
        return min(impact_score, 1.0)
    
    def _is_related(self, test_id: str, file_path: str) -> bool:
        """Check if a test is related to a changed file"""
        # Simplified relationship check
        # In a real system, this would use dependency analysis
        return file_path in test_id or test_id in file_path

class ChangeImpactAnalyzer:
    """Analyzes the impact of code changes on tests"""
    
    def __init__(self):
        self.dependency_graph = {}
        self.coverage_data = {}
    
    def analyze_impact(self, code_changes: Dict) -> List[str]:
        """Analyze which tests are impacted by code changes"""
        impacted_tests = set()
        changed_files = code_changes.get('files', [])
        
        for changed_file in changed_files:
            # Direct impact - tests that directly test the changed file
            direct_tests = self._get_direct_tests(changed_file)
            impacted_tests.update(direct_tests)
            
            # Indirect impact - tests that depend on changed components
            indirect_tests = self._get_indirect_tests(changed_file)
            impacted_tests.update(indirect_tests)
        
        return list(impacted_tests)
    
    def _get_direct_tests(self, file_path: str) -> List[str]:
        """Get tests that directly test a file"""
        # Simplified implementation
        # In a real system, this would use code coverage data
        if 'test' in file_path.lower():
            return [file_path]
        return []
    
    def _get_indirect_tests(self, file_path: str) -> List[str]:
        """Get tests that indirectly depend on a file"""
        # Simplified implementation
        # In a real system, this would use dependency analysis
        return []

def generate_sample_data() -> List[Dict]:
    """Generate sample training data for the ML model"""
    logger.info("Generating sample training data...")
    
    sample_data = []
    
    # Generate sample test records
    for i in range(1000):
        record = {
            'test_id': f'test_{i}',
            'duration': np.random.exponential(10),
            'code': 'sample test code ' * np.random.randint(10, 100),
            'complexity_score': np.random.randint(1, 10),
            'historical_failure_rate': np.random.beta(2, 8),
            'recent_failures': np.random.poisson(1),
            'days_since_last_failure': np.random.exponential(30),
            'lines_changed': np.random.poisson(20),
            'files_changed': np.random.poisson(3),
            'commit_frequency': np.random.poisson(5),
            'cpu_usage': np.random.uniform(0, 100),
            'memory_usage': np.random.uniform(0, 100),
            'test_type': np.random.choice(['unit', 'integration', 'e2e']),
            'dependency_count': np.random.poisson(5),
            'external_api_calls': np.random.poisson(2),
            'failed': np.random.choice([True, False], p=[0.2, 0.8])
        }
        sample_data.append(record)
    
    logger.info(f"Generated {len(sample_data)} sample records")
    return sample_data

def main():
    """Main function to demonstrate the ML failure predictor"""
    logger.info("🤖 Starting ML Failure Predictor")
    
    # Initialize predictor
    predictor = TestFailurePredictor()
    
    # Generate sample data
    sample_data = generate_sample_data()
    
    # Prepare training data
    X, y = predictor.prepare_training_data(sample_data)
    
    # Train model
    predictor.train_model(X, y)
    
    # Test prediction
    test_sample = {
        'duration': 15,
        'code': 'test code',
        'complexity_score': 5,
        'historical_failure_rate': 0.3,
        'recent_failures': 2,
        'days_since_last_failure': 5,
        'lines_changed': 50,
        'files_changed': 3,
        'commit_frequency': 10,
        'cpu_usage': 80,
        'memory_usage': 70,
        'test_type': 'integration',
        'dependency_count': 8,
        'external_api_calls': 3
    }
    
    # Predict failure
    failure_prob, confidence = predictor.predict_failure(test_sample)
    insights = predictor.generate_insights(test_sample)
    
    logger.info(f"Failure Probability: {failure_prob:.4f}")
    logger.info(f"Confidence: {confidence}")
    logger.info(f"Risk Level: {insights['risk_level']}")
    logger.info(f"Recommendations: {insights['recommendations']}")
    
    # Test intelligent test selection
    selector = IntelligentTestSelector(predictor)
    
    # Register some tests
    for i in range(10):
        selector.register_test(f'test_{i}', {
            'test_type': 'unit',
            'duration': np.random.exponential(5),
            'complexity_score': np.random.randint(1, 5)
        })
    
    # Select tests for code changes
    code_changes = {
        'files': ['src/component.py', 'src/utils.py'],
        'lines_added': 20,
        'lines_deleted': 5
    }
    
    selected_tests = selector.select_tests(code_changes, max_tests=5)
    logger.info(f"Selected tests: {selected_tests}")
    
    logger.info("🎉 ML Failure Predictor demonstration completed")

if __name__ == "__main__":
    main()
