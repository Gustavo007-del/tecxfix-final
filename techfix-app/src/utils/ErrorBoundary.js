import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error details for debugging
    if (error && error.stack) {
    }
    if (errorInfo && errorInfo.componentStack) {
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <MaterialIcons name="error-outline" size={64} color={COLORS.danger} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an unexpected error. You can try restarting the app or contact support if this persists.
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => {
              // Reload the app
              if (typeof Expo !== 'undefined' && Expo.Constants) {
                // In Expo environment
                this.props.onRestart && this.props.onRestart();
              } else {
                // Fallback for non-Expo
                this.handleRetry();
              }
            }}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
    textAlign: 'center',
    color: COLORS.dark,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: COLORS.gray,
    lineHeight: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: COLORS.primary,
  },
});

export default ErrorBoundary;
