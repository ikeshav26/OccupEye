import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getAlertsApi, resolveAlertApi, type AlertItem } from '../services/api';
import { onNewAlert, onAlertResolved } from '../services/socket';
import { useToast } from '../context/ToastContext';

export default function AlertsScreen() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'active' | 'resolved'>('active');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const isResolved = filter === 'resolved';
      const data = await getAlertsApi(isResolved);
      if (data.success && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Could not load alerts.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter, showToast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    let unsubscribeNew: (() => void) | undefined;
    let unsubscribeResolved: (() => void) | undefined;

    onNewAlert((newAlert) => {
      if (filter === 'active') {
        setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
      }
    }).then((unsub) => {
      unsubscribeNew = unsub;
    });

    onAlertResolved((resolvedAlert) => {
      setAlerts((prev) =>
        filter === 'active'
          ? prev.filter((a) => a.id !== resolvedAlert.id)
          : [resolvedAlert, ...prev.filter((a) => a.id !== resolvedAlert.id)]
      );
    }).then((unsub) => {
      unsubscribeResolved = unsub;
    });

    return () => {
      if (unsubscribeNew) unsubscribeNew();
      if (unsubscribeResolved) unsubscribeResolved();
    };
  }, [filter, showToast]);

  const handleTurnOffFans = () => {
    showToast({
      type: 'info',
      title: 'IoT Integration',
      message: 'IoT integration coming soon.',
    });
  };

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      const res = await resolveAlertApi(id);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Resolved',
          message: `Alert #${id} marked as resolved.`,
        });
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to resolve alert.',
      });
    } finally {
      setResolvingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const renderAlertCard = ({ item }: { item: AlertItem }) => {
    const isResolving = resolvingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.roomName}>{item.classroomId.replace('_', ' ').toUpperCase()}</Text>
            <Text style={styles.timestamp}>• {formatDate(item.createdAt)}</Text>
          </View>

          <View style={styles.headerRight}>
            <View
              style={[
                styles.dot,
                { backgroundColor: item.isResolved ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text style={styles.statusLabel}>
              {item.isResolved ? 'Resolved' : 'Active'}
            </Text>
          </View>
        </View>

        {item.snapshotUrl ? (
          <Image
            source={{ uri: item.snapshotUrl }}
            style={styles.snapshotImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>
            Occupants: <Text style={styles.metricBold}>{item.studentCount}</Text>
          </Text>
          <Text style={styles.metricBullet}>•</Text>
          <Text style={styles.metricText}>
            Fan: <Text style={styles.metricBold}>{item.fanStatus}</Text>
          </Text>
          <Text style={styles.metricBullet}>•</Text>
          <Text style={styles.metricText}>
            Idle: <Text style={styles.metricBold}>{item.idleSeconds}s</Text>
          </Text>
        </View>

        {!item.isResolved && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.turnOffBtn}
              onPress={handleTurnOffFans}
              activeOpacity={0.85}>
              <Feather name="power" size={14} color="#0F172A" style={{ marginRight: 6 }} />
              <Text style={styles.turnOffBtnText}>Turn off Fans</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resolveBtn, isResolving && styles.btnDisabled]}
              onPress={() => handleResolve(item.id)}
              disabled={isResolving}
              activeOpacity={0.85}>
              {isResolving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.resolveBtnText}>Resolve Alert</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchAlerts(false)}
          activeOpacity={0.7}>
          <Feather name="refresh-cw" size={15} color="#8C827A" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, filter === 'active' && styles.tabActive]}
          onPress={() => setFilter('active')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, filter === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'resolved' && styles.tabActive]}
          onPress={() => setFilter('resolved')}
          activeOpacity={0.8}>
          <Text style={[styles.tabText, filter === 'resolved' && styles.tabTextActive]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#00A896" />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAlertCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchAlerts(true)}
              tintColor="#00A896"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {filter === 'active' ? 'No active alerts' : 'No resolved history'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'active'
                  ? 'All classrooms are operating normally.'
                  : 'Resolved incidents will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8DE',
  },
  title: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C1917',
    letterSpacing: -0.5,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE2D5',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8DE',
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE2D5',
  },
  tabActive: {
    backgroundColor: '#00A896',
    borderColor: '#00A896',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#68625D',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAE2D5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1917',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8C827A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#68625D',
  },
  snapshotImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#1C1917',
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EFEB',
  },
  metricText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#68625D',
  },
  metricBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1917',
  },
  metricBullet: {
    marginHorizontal: 8,
    color: '#D6CEC5',
    fontSize: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  turnOffBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAE2D5',
    backgroundColor: '#F5EFEB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turnOffBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1917',
  },
  resolveBtn: {
    flex: 1,
    backgroundColor: '#00A896',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  resolveBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1917',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#8C827A',
    textAlign: 'center',
  },
});
