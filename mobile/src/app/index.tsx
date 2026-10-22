import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../components/LoginScreen';
import DashboardScreen from '../components/DashboardScreen';
import AlertsScreen from '../components/AlertsScreen';
import { useToast } from '../context/ToastContext';
import { getAlertsApi } from '../services/api';
import { onNewAlert, onAlertResolved } from '../services/socket';
import {
  registerForPushNotifications,
  triggerAlertNotification,
} from '../services/notifications';

export default function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts'>('dashboard');
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().catch(() => {});

    getAlertsApi(false)
      .then((res) => {
        if (res.success && typeof res.count === 'number') {
          setActiveAlertCount(res.count);
        }
      })
      .catch(() => {});

    let unsubNew: (() => void) | undefined;
    let unsubResolved: (() => void) | undefined;

    onNewAlert((newAlert) => {
      setActiveAlertCount((prev) => prev + 1);

      showToast({
        type: 'info',
        title: `Incident: ${newAlert.classroomId.replace('_', ' ').toUpperCase()}`,
        message: `Fan ON with ${newAlert.studentCount} students for ${newAlert.idleSeconds}s!`,
      });

      triggerAlertNotification(newAlert).catch((err) => {
        console.warn('[Notification] Error presenting system notification:', err);
      });
    }).then((unsub) => {
      unsubNew = unsub;
    });

    onAlertResolved(() => {
      setActiveAlertCount((prev) => Math.max(0, prev - 1));
    }).then((unsub) => {
      unsubResolved = unsub;
    });

    return () => {
      if (unsubNew) unsubNew();
      if (unsubResolved) unsubResolved();
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00A896" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'dashboard' ? <DashboardScreen /> : <AlertsScreen />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.7}>
          <Feather
            name="user"
            size={20}
            color={activeTab === 'dashboard' ? '#00A896' : '#8C827A'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'dashboard' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}>
            Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('alerts')}
          activeOpacity={0.7}>
          <View style={styles.iconBox}>
            <Feather
              name="bell"
              size={20}
              color={activeTab === 'alerts' ? '#00A896' : '#8C827A'}
            />
            {activeAlertCount > 0 && (
              <View style={styles.badgeDot} />
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'alerts' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}>
            Alerts
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 82 : 64,
    backgroundColor: '#FAF7F2',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EFE8DE',
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  tabLabelActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#00A896',
  },
  tabLabelInactive: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8C827A',
  },
});
