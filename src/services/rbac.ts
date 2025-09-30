import { getCurrentSession } from './authService';

/**
 * User roles in the system
 */
export enum UserRole {
  OWNER = 'owner',       // Full system access
  ADMIN = 'admin',       // Manage members, logs, settings
  OPERATOR = 'operator', // Run scans, view members
  VIEWER = 'viewer'      // View-only access
}

/**
 * Permissions available in the system
 */
export enum Permission {
  // Member Management
  VIEW_MEMBERS = 'view_members',
  ADD_MEMBERS = 'add_members',
  EDIT_MEMBERS = 'edit_members',
  DELETE_MEMBERS = 'delete_members',
  CHANGE_MEMBER_STATUS = 'change_member_status',

  // Attendance Logs
  VIEW_LOGS = 'view_logs',
  DELETE_LOGS = 'delete_logs',
  EXPORT_LOGS = 'export_logs',

  // Scanner Operations
  RUN_SCANNER = 'run_scanner',
  REGISTER_NEW_FACE = 'register_new_face',

  // Organization Settings
  VIEW_SETTINGS = 'view_settings',
  MODIFY_SETTINGS = 'modify_settings',
  MANAGE_API_KEYS = 'manage_api_keys',

  // User Management
  VIEW_USERS = 'view_users',
  ADD_USERS = 'add_users',
  MODIFY_USER_ROLES = 'modify_user_roles',
  DELETE_USERS = 'delete_users',

  // Security
  VIEW_SECURITY_EVENTS = 'view_security_events',
  MANAGE_SECURITY_SETTINGS = 'manage_security_settings'
}

/**
 * Role-Permission mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    // Owners have all permissions
    Permission.VIEW_MEMBERS,
    Permission.ADD_MEMBERS,
    Permission.EDIT_MEMBERS,
    Permission.DELETE_MEMBERS,
    Permission.CHANGE_MEMBER_STATUS,
    Permission.VIEW_LOGS,
    Permission.DELETE_LOGS,
    Permission.EXPORT_LOGS,
    Permission.RUN_SCANNER,
    Permission.REGISTER_NEW_FACE,
    Permission.VIEW_SETTINGS,
    Permission.MODIFY_SETTINGS,
    Permission.MANAGE_API_KEYS,
    Permission.VIEW_USERS,
    Permission.ADD_USERS,
    Permission.MODIFY_USER_ROLES,
    Permission.DELETE_USERS,
    Permission.VIEW_SECURITY_EVENTS,
    Permission.MANAGE_SECURITY_SETTINGS
  ],

  [UserRole.ADMIN]: [
    // Admins can manage members and view logs
    Permission.VIEW_MEMBERS,
    Permission.ADD_MEMBERS,
    Permission.EDIT_MEMBERS,
    Permission.DELETE_MEMBERS,
    Permission.CHANGE_MEMBER_STATUS,
    Permission.VIEW_LOGS,
    Permission.EXPORT_LOGS,
    Permission.RUN_SCANNER,
    Permission.REGISTER_NEW_FACE,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_USERS,
    Permission.VIEW_SECURITY_EVENTS
  ],

  [UserRole.OPERATOR]: [
    // Operators can run scans and view members
    Permission.VIEW_MEMBERS,
    Permission.VIEW_LOGS,
    Permission.RUN_SCANNER,
    Permission.REGISTER_NEW_FACE
  ],

  [UserRole.VIEWER]: [
    // Viewers can only view
    Permission.VIEW_MEMBERS,
    Permission.VIEW_LOGS
  ]
};

/**
 * Check if user has a specific permission
 */
export const hasPermission = (permission: Permission): boolean => {
  const session = getCurrentSession();
  if (!session) return false;

  const userRole = session.user.role as UserRole;
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];

  return rolePermissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(permission));
};

/**
 * Get all permissions for current user
 */
export const getUserPermissions = (): Permission[] => {
  const session = getCurrentSession();
  if (!session) return [];

  const userRole = session.user.role as UserRole;
  return ROLE_PERMISSIONS[userRole] || [];
};

/**
 * Check if user has specific role
 */
export const hasRole = (role: UserRole): boolean => {
  const session = getCurrentSession();
  if (!session) return false;

  return session.user.role === role;
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (roles: UserRole[]): boolean => {
  const session = getCurrentSession();
  if (!session) return false;

  return roles.includes(session.user.role as UserRole);
};

/**
 * Check if user is admin (owner or admin role)
 */
export const isAdmin = (): boolean => {
  return hasAnyRole([UserRole.OWNER, UserRole.ADMIN]);
};

/**
 * Check if user is owner
 */
export const isOwner = (): boolean => {
  return hasRole(UserRole.OWNER);
};

/**
 * Get user's role
 */
export const getUserRole = (): UserRole | null => {
  const session = getCurrentSession();
  if (!session) return null;

  return session.user.role as UserRole;
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    [UserRole.OWNER]: 'Owner',
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.OPERATOR]: 'Operator',
    [UserRole.VIEWER]: 'Viewer'
  };

  return displayNames[role] || role;
};

/**
 * Get permission display name
 */
export const getPermissionDisplayName = (permission: Permission): string => {
  return permission
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Check if action requires elevated permissions
 */
export const requiresElevatedPermissions = (action: string): boolean => {
  const elevatedActions = [
    'delete_member',
    'delete_user',
    'change_role',
    'modify_settings',
    'regenerate_api_key',
    'delete_organization'
  ];

  return elevatedActions.includes(action);
};

/**
 * Validate permission with error throwing
 */
export const requirePermission = (permission: Permission): void => {
  if (!hasPermission(permission)) {
    const session = getCurrentSession();
    const userRole = session?.user.role || 'unknown';

    throw new Error(
      `Permission denied: ${getPermissionDisplayName(permission)} requires elevated access. Current role: ${userRole}`
    );
  }
};

/**
 * Validate multiple permissions
 */
export const requireAllPermissions = (permissions: Permission[]): void => {
  if (!hasAllPermissions(permissions)) {
    throw new Error(
      `Permission denied: This action requires multiple permissions that your current role does not have.`
    );
  }
};

export default {
  UserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  hasRole,
  hasAnyRole,
  isAdmin,
  isOwner,
  getUserRole,
  getRoleDisplayName,
  getPermissionDisplayName,
  requiresElevatedPermissions,
  requirePermission,
  requireAllPermissions
};