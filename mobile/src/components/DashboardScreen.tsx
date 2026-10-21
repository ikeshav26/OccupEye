import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { changePasswordApi, updateUsernameApi } from '../services/api';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  CURRENT_VERSION,
  type AppReleaseInfo,
} from '../services/updater';

export default function DashboardScreen() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();

  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppReleaseInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCheckUpdate = useCallback(async (isSilent = false) => {
    setIsCheckingUpdate(true);
    try {
      const info = await checkForAppUpdate();
      setUpdateInfo(info);
      if (!isSilent) {
        if (info.hasUpdate) {
          showToast({
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is ready to download!`,
          });
        } else {
          showToast({
            type: 'success',
            title: 'Up to Date',
            message: `OccupEye v${CURRENT_VERSION} is the latest version.`,
          });
        }
      }
    } catch {
      if (!isSilent) {
        showToast({
          type: 'error',
          title: 'Update Error',
          message: 'Unable to check for updates right now.',
        });
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [showToast]);

  useEffect(() => {
    handleCheckUpdate(true);
  }, [handleCheckUpdate]);

  const handleUpdateApp = async () => {
    if (!updateInfo?.downloadUrl) {
      showToast({
        type: 'error',
        title: 'Download Error',
        message: 'No download URL found for this release.',
      });
      return;
    }

    setIsUpdating(true);
    showToast({
      type: 'info',
      title: 'Downloading Update',
      message: `Downloading v${updateInfo.version}... Confirm the prompt to update your app.`,
    });

    const success = await downloadAndInstallUpdate(updateInfo.downloadUrl);
    setIsUpdating(false);

    if (!success) {
      showToast({
        type: 'error',
        title: 'Launch Failed',
        message: 'Could not open package installer automatically.',
      });
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      showToast({
        type: 'error',
        title: 'Validation',
        message: 'Username cannot be blank.',
      });
      return;
    }

    if (newUsername.trim() === user?.username) {
      showToast({
        type: 'info',
        title: 'No Change',
        message: 'The username is already set to this value.',
      });
      return;
    }

    setIsUpdatingUsername(true);
    try {
      const res = await updateUsernameApi(newUsername.trim());
      if (res.success) {
        await updateUser(res.user, res.token);
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Username updated successfully.',
        });
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update username.';
      showToast({
        type: 'error',
        title: 'Error',
        message,
      });
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      showToast({
        type: 'error',
        title: 'Validation',
        message: 'Current and new password are required.',
      });
      return;
    }

    if (newPassword.length < 6) {
      showToast({
        type: 'error',
        title: 'Validation',
        message: 'Password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        type: 'error',
        title: 'Validation',
        message: 'Passwords do not match.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePasswordApi(currentPassword, newPassword);
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Password changed successfully.',
        });
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Current password incorrect.';
      showToast({
        type: 'error',
        title: 'Error',
        message,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast({
      type: 'info',
      title: 'Logged Out',
      message: 'Signed out successfully.',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Manage your credentials and security</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={14} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Signed in as</Text>
          <Text style={styles.infoValue}>{user?.username || 'Admin'}</Text>
        </View>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>Administrator</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Username</Text>
        <View style={styles.fieldBox}>
          <TextInput
            style={styles.input}
            value={newUsername}
            onChangeText={setNewUsername}
            placeholder="Username"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, isUpdatingUsername && styles.btnDisabled]}
          onPress={handleUpdateUsername}
          disabled={isUpdatingUsername}
          activeOpacity={0.85}>
          {isUpdatingUsername ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Update Username</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <View style={styles.fieldBox}>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather
              name={showCurrentPassword ? 'eye' : 'eye-off'}
              size={16}
              color="#94A3B8"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldBox}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password (min 6 characters)"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowNewPassword(!showNewPassword)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather
              name={showNewPassword ? 'eye' : 'eye-off'}
              size={16}
              color="#94A3B8"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldBox}>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, isChangingPassword && styles.btnDisabled]}
          onPress={handleChangePassword}
          disabled={isChangingPassword}
          activeOpacity={0.85}>
          {isChangingPassword ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>App Version & Updates</Text>
          <TouchableOpacity
            onPress={() => handleCheckUpdate(false)}
            disabled={isCheckingUpdate}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.checkUpdateIconBtn}>
            {isCheckingUpdate ? (
              <ActivityIndicator size="small" color="#00A896" />
            ) : (
              <Feather name="refresh-cw" size={15} color="#64748B" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.updateCard}>
          <View style={styles.updateCardTop}>
            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Installed Version</Text>
              <Text style={styles.versionValue}>v{CURRENT_VERSION}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                updateInfo?.hasUpdate ? styles.statusBadgeUpdate : styles.statusBadgeLatest,
              ]}>
              <Feather
                name={updateInfo?.hasUpdate ? 'arrow-up-circle' : 'check-circle'}
                size={12}
                color={updateInfo?.hasUpdate ? '#00A896' : '#10B981'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  updateInfo?.hasUpdate
                    ? styles.statusBadgeTextUpdate
                    : styles.statusBadgeTextLatest,
                ]}>
                {isCheckingUpdate
                  ? 'Checking...'
                  : updateInfo?.hasUpdate
                  ? `v${updateInfo.version} Available`
                  : 'Up to Date'}
              </Text>
            </View>
          </View>

          {updateInfo?.hasUpdate ? (
            <TouchableOpacity
              style={[styles.updateActionBtn, isUpdating && styles.btnDisabled]}
              onPress={handleUpdateApp}
              disabled={isUpdating}
              activeOpacity={0.85}>
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="download-cloud" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.updateActionBtnText}>
                    Download & Install Update (v{updateInfo.version})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.upToDateBox}>
              <Feather name="check" size={14} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={styles.upToDateText}>You are on the latest version of OccupEye</Text>
            </View>
          )}

          <View style={styles.authorRow}>
            <Text style={styles.authorText}>
              Author: <Text style={styles.authorBold}>Keshav Gilhotra</Text>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 62 : 46,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 24,
  },
  headerTitleWrapper: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  logoutText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginTop: 3,
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  section: {
    marginVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 0,
  },
  checkUpdateIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
  },
  primaryBtn: {
    backgroundColor: '#00A896',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 28,
  },
  updateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  updateCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  versionCol: {
    flex: 1,
  },
  versionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  versionValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeLatest: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeUpdate: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  statusBadgeTextLatest: {
    color: '#059669',
  },
  statusBadgeTextUpdate: {
    color: '#00A896',
  },
  updateActionBtn: {
    flexDirection: 'row',
    backgroundColor: '#00A896',
    borderRadius: 10,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  updateActionBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  upToDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 2,
  },
  upToDateText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  authorRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  authorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  authorBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
});
