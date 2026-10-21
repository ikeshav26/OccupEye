import React, { useState } from 'react';
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
import { sendTestNotification } from '../services/notifications';

export default function DashboardScreen() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();

  const handleTestNotification = async () => {
    const res = await sendTestNotification();
    showToast({
      type: res.success ? 'success' : 'error',
      title: res.success ? 'Notification Sent' : 'Permission Error',
      message: res.message,
    });
  };

  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
        <Text style={styles.sectionTitle}>Device Notifications</Text>
        <Text style={styles.sectionSubtitle}>
          Verify that system alerts, sound, vibration, and lock screen notifications are active on this phone.
        </Text>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleTestNotification}
          activeOpacity={0.85}>
          <Feather name="bell" size={15} color="#0F172A" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryBtnText}>Test Mobile Notification</Text>
        </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 14,
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
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  secondaryBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
});
