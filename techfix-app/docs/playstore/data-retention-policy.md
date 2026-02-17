# TECHFIX Data Retention Policy
**Effective Date: January 21, 2026**

## Overview
TECHFIX collects and processes location data for field service management purposes. This policy outlines our data retention practices to ensure compliance with privacy regulations and user rights.

## Data Types Collected

### 1. Location Data
- **GPS Coordinates**: Latitude and longitude
- **Location Accuracy**: GPS precision information
- **Timestamp**: Date and time of location capture
- **Location Context**: Check-in/check-out events

### 2. Work-Related Data
- **Attendance Records**: Check-in/out times with location verification
- **Work Session Data**: Duration and location of work periods
- **Service Locations**: Customer site addresses (derived from coordinates)

## Retention Periods

### Location Data
| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| GPS Coordinates | 6 months from collection | Automated secure deletion |
| Location Accuracy | 6 months from collection | Automated secure deletion |
| Timestamp Data | 6 months from collection | Automated secure deletion |
| Attendance Records | 2 years for payroll/HR | Secure archive, then deletion |

### Work Session Data
| Data Type | Retention Period | Purpose |
|-----------|------------------|---------|
| Daily Attendance | 2 years | Payroll, compliance, performance |
| Work Routes | 6 months | Operational analysis |
| Customer Locations | 6 months | Service optimization |

## Automated Deletion Process

### Daily Cleanup
- Location data older than 6 months is automatically purged
- Temporary cache files cleared every 24 hours
- Failed location attempts deleted after 7 days

### Monthly Maintenance
- Review and delete orphaned data records
- Optimize database storage
- Verify deletion compliance

### Annual Audit
- Complete data retention audit
- Verify all automated deletions
- Update retention schedules if needed

## Data Access and Security

### Access Controls
- **Admin Access**: Only authorized administrators can access raw location data
- **Technician Access**: Users can only see their own location history
- **Role-Based Access**: Different access levels based on job role
- **Audit Logging**: All data access is logged and monitored

### Security Measures
- **Encryption**: All location data encrypted in transit and at rest
- **Secure Servers**: Data stored on secure, access-controlled servers
- **Regular Backups**: Encrypted backups with same retention policies
- **Access Monitoring**: Real-time monitoring of data access patterns

## User Rights and Controls

### Data Access
- Users can request their complete location history
- Data export available in CSV format
- 30-day response time for data requests

### Data Deletion
- Users can request early deletion of their location data
- Emergency deletion available for safety concerns
- Account deletion removes all associated data immediately

### Privacy Controls
- Users can pause location tracking during work hours
- Location accuracy can be reduced if needed
- Users can review all collected location data

## Legal and Compliance

### Compliance Requirements
- **GDPR**: 6-month retention for location data, right to be forgotten
- **CCPA**: Consumer data access and deletion rights
- **Local Labor Laws**: Attendance record retention requirements
- **Industry Standards**: Field service best practices

### Legal Holds
- Data may be retained longer if required for legal proceedings
- Legal holds are documented and time-limited
- Normal deletion resumes after legal hold expires

## Data Processing Locations

### Primary Storage
- **Region**: India (primary user base)
- **Data Centers**: Secure, certified facilities
- **Backup Locations**: Geographic redundancy for disaster recovery

### International Transfers
- Limited international data transfers
- Standard contractual clauses in place
- Data protection agreements with all processors

## Third-Party Processors

### Service Providers
- **Cloud Provider**: AWS/Google Cloud with security certifications
- **Database Providers**: Encrypted database services
- **Analytics Tools**: Anonymized data only

### Processor Agreements
- Data processing agreements with all third parties
- Same retention policies enforced on processors
- Right to audit processor compliance

## Policy Updates

### Review Schedule
- **Annual Review**: Complete policy review and update
- **Regulatory Changes**: Immediate updates for legal changes
- **Technology Changes**: Review when new technologies implemented

### User Notifications
- 30-day notice for significant policy changes
- In-app notifications for policy updates
- Email notifications for major changes

## Contact Information

### Data Protection Officer
- **Email**: shijilkt27@gmail.com
- **Phone**: 9061444017
- **Address**: ASA Lab's, vengeri, kozhikode, kerala

### Complaint Process
- Internal complaint resolution within 30 days
- External escalation to regulatory authorities if needed
- Transparent communication about complaint status

## Implementation Verification

### Technical Controls
- Automated deletion scripts tested monthly
- Retention policy enforced at database level
- Regular compliance audits

### Monitoring
- Real-time monitoring of data retention compliance
- Alerts for policy violations
- Monthly compliance reports to management

This policy ensures TECHFIX maintains the minimum necessary data for the shortest required duration while protecting user privacy and meeting business requirements.
