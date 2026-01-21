import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

export default function LocationDisclosureScreen({ onAccept, onDecline }) {
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleAccept = () => {
    Alert.alert(
      'Location Access',
      'Thank you for understanding. You will now be prompted to grant location permissions.',
      [
        { text: 'OK', onPress: onAccept }
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Location Required',
      'TECHFIX requires location access for essential features. Without location access, the app will not function properly.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Accept Anyway', onPress: onAccept }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="location-on" size={48} color={COLORS.primary} />
          <Text style={styles.title}>Location Access Required</Text>
          <Text style={styles.subtitle}>TECHFIX needs location permission to provide essential field service features</Text>
        </View>

        {/* Why Location is Needed */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('why')}
          >
            <MaterialIcons name="help-outline" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Why Location is Needed</Text>
            <MaterialIcons 
              name={expandedSection === 'why' ? "expand-less" : "expand-more"} 
              size={24} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          {expandedSection === 'why' && (
            <View style={styles.sectionContent}>
              <Text style={styles.contentText}>
                TECHFIX is a field service management app that requires location access for:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>Automatic attendance verification</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>Work hour location tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>Technician safety monitoring</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>Real-time operational coordination</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Why Background Location */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('background')}
          >
            <MaterialIcons name="access-time" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Why Background Location</Text>
            <MaterialIcons 
              name={expandedSection === 'background' ? "expand-less" : "expand-more"} 
              size={24} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          {expandedSection === 'background' && (
            <View style={styles.sectionContent}>
              <Text style={styles.contentText}>
                Background location is required because:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="work" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Technicians work in the field away from their phones</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="update" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Location updates every 5 minutes during work hours</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="security" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Continuous safety monitoring for field staff</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="assessment" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Accurate work records and payroll</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* What Breaks Without Location */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('breaks')}
          >
            <MaterialIcons name="warning" size={24} color={COLORS.danger} />
            <Text style={styles.sectionTitle}>What Breaks Without Location</Text>
            <MaterialIcons 
              name={expandedSection === 'breaks' ? "expand-less" : "expand-more"} 
              size={24} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          {expandedSection === 'breaks' && (
            <View style={styles.sectionContent}>
              <Text style={styles.contentText}>
                Without location access, these features will stop working:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="block" size={16} color={COLORS.danger} />
                  <Text style={styles.featureText}>❌ Attendance check-in/check-out</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="block" size={16} color={COLORS.danger} />
                  <Text style={styles.featureText}>❌ Work hour tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="block" size={16} color={COLORS.danger} />
                  <Text style={styles.featureText}>❌ Technician location monitoring</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="block" size={16} color={COLORS.danger} />
                  <Text style={styles.featureText}>❌ Emergency location assistance</Text>
                </View>
              </View>
              <Text style={styles.warningText}>
                ⚠️ The app will not function properly without location access.
              </Text>
            </View>
          )}
        </View>

        {/* What Data is Collected */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('dataCollected')}
          >
            <MaterialIcons name="data-usage" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>What Data is Collected</Text>
            <MaterialIcons 
              name={expandedSection === 'dataCollected' ? "expand-less" : "expand-more"} 
              size={24} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          {expandedSection === 'dataCollected' && (
            <View style={styles.sectionContent}>
              <View style={styles.dataCollectionBox}>
                <Text style={styles.dataCategory}>📍 What Data:</Text>
                <Text style={styles.dataDetail}>• GPS coordinates (latitude, longitude)</Text>
                <Text style={styles.dataDetail}>• Location accuracy</Text>
                <Text style={styles.dataDetail}>• Timestamp of location update</Text>
                
                <Text style={styles.dataCategory}>📅 When:</Text>
                <Text style={styles.dataDetail}>• During work hours (check-in to check-out)</Text>
                <Text style={styles.dataDetail}>• Every 5 minutes when checked in</Text>
                <Text style={styles.dataDetail}>• During check-in/check-out events</Text>
                
                <Text style={styles.dataCategory}>🎯 Why:</Text>
                <Text style={styles.dataDetail}>• Attendance verification with precise location</Text>
                <Text style={styles.dataDetail}>• Technician safety monitoring</Text>
                <Text style={styles.dataDetail}>• Operational coordination</Text>
                <Text style={styles.dataDetail}>• Emergency location assistance</Text>
              </View>
              
              {/* Example Text as Required */}
              <View style={styles.exampleBox}>
                <Text style={styles.exampleTitle}>Example:</Text>
                <Text style={styles.exampleText}>
                  "TECHFIX collects location data to track technician work sessions even when the app is closed."
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Data Usage */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('data')}
          >
            <MaterialIcons name="security" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>How Location Data is Used</Text>
            <MaterialIcons 
              name={expandedSection === 'data' ? "expand-less" : "expand-more"} 
              size={24} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          {expandedSection === 'data' && (
            <View style={styles.sectionContent}>
              <Text style={styles.contentText}>
                Your location data is used responsibly:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="schedule" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Only during work hours (check-in to check-out)</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="timer" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Updates every 5 minutes to conserve battery</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="lock" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Encrypted transmission to secure servers</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="business" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Used only for work-related operations</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <MaterialIcons name="check-circle" size={24} color={COLORS.white} />
            <Text style={styles.acceptButtonText}>I Understand - Enable Location</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={handleDecline}
          >
            <MaterialIcons name="cancel" size={24} color={COLORS.gray} />
            <Text style={styles.declineButtonText}>Decline - Limited Functionality</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <MaterialIcons name="privacy-tip" size={16} color={COLORS.gray} />
          <Text style={styles.privacyText}>
            Your privacy is important. Location data is used only for work purposes and is never shared with third parties.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: COLORS.light,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginLeft: 12,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  contentText: {
    fontSize: 16,
    color: COLORS.gray,
    lineHeight: 22,
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.dark,
    marginLeft: 8,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 16,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  declineButton: {
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  declineButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.light,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray,
    marginLeft: 8,
    lineHeight: 18,
  },
  exampleBox: {
    backgroundColor: COLORS.primary + '10',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: COLORS.dark,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  dataCollectionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  dataCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  dataDetail: {
    fontSize: 14,
    color: COLORS.dark,
    marginLeft: 16,
    marginBottom: 4,
    lineHeight: 18,
  },
});
