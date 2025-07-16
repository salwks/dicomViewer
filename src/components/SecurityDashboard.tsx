import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Download, 
  Settings, 
  LogOut,
  Users,
  FileText,
  Clock,
  Lock
} from 'lucide-react';
import { useSecurityStore } from '../store';

export const SecurityDashboard: React.FC = () => {
  const {
    currentUser,
    securityEvents,
    settings,
    logout,
    getSecurityEvents,
    generateSecurityReport,
    clearSecurityEvents,
    updateLastActivity,
    checkSessionTimeout
  } = useSecurityStore();

  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [showSettings, setShowSettings] = useState(false);

  // Update activity and check session timeout
  useEffect(() => {
    const interval = setInterval(() => {
      updateLastActivity();
      checkSessionTimeout();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [updateLastActivity, checkSessionTimeout]);

  const filteredEvents = selectedEventType === 'ALL' 
    ? securityEvents 
    : getSecurityEvents(selectedEventType as any);

  const eventTypeColors = {
    'LOGIN': 'bg-green-100 text-green-800',
    'LOGOUT': 'bg-blue-100 text-blue-800',
    'ACCESS_DENIED': 'bg-red-100 text-red-800',
    'FILE_ACCESS': 'bg-yellow-100 text-yellow-800',
    'TOOL_USAGE': 'bg-purple-100 text-purple-800',
    'EXPORT': 'bg-orange-100 text-orange-800',
    'ERROR': 'bg-red-100 text-red-800',
  };

  const severityColors = {
    'LOW': 'bg-green-500',
    'MEDIUM': 'bg-yellow-500',
    'HIGH': 'bg-orange-500',
    'CRITICAL': 'bg-red-500',
  };

  const handleDownloadReport = () => {
    const report = generateSecurityReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getSessionTimeRemaining = () => {
    if (!currentUser) return 0;
    const now = Date.now();
    const sessionAge = now - currentUser.lastActivity;
    const timeoutMs = settings.sessionTimeout * 60 * 1000;
    return Math.max(0, timeoutMs - sessionAge);
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="security-dashboard p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="text-blue-600" size={32} />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
                <p className="text-gray-600">Welcome back, {currentUser.username}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={logout}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* User Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current User</p>
                <p className="text-2xl font-bold text-gray-900">{currentUser.username}</p>
                <p className="text-sm text-blue-600">{currentUser.role}</p>
              </div>
              <Users className="text-blue-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Session Duration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(Date.now() - currentUser.loginTime)}
                </p>
              </div>
              <Clock className="text-green-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Remaining</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(getSessionTimeRemaining())}
                </p>
              </div>
              <Lock className="text-orange-600" size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Security Events</p>
                <p className="text-2xl font-bold text-gray-900">{securityEvents.length}</p>
              </div>
              <Activity className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Security Events */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Security Events</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">All Events</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="ACCESS_DENIED">Access Denied</option>
                  <option value="FILE_ACCESS">File Access</option>
                  <option value="TOOL_USAGE">Tool Usage</option>
                  <option value="EXPORT">Export</option>
                  <option value="ERROR">Error</option>
                </select>
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Download size={16} />
                  <span>Export Report</span>
                </button>
                <button
                  onClick={clearSecurityEvents}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Clear Events
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No security events found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredEvents.slice().reverse().map((event) => (
                  <div key={event.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            eventTypeColors[event.type] || 'bg-gray-100 text-gray-800'
                          }`}>
                            {event.type}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${severityColors[event.severity]}`} />
                          <span className="text-sm text-gray-600">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-900">{event.details}</p>
                        {event.metadata && (
                          <div className="mt-2 text-xs text-gray-500">
                            <pre className="bg-gray-100 p-2 rounded">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      {event.userId && (
                        <span className="ml-4 text-sm text-gray-600">
                          {event.userId}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Failed Attempts
                  </label>
                  <input
                    type="number"
                    value={settings.maxFailedAttempts}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max File Size (MB)
                  </label>
                  <input
                    type="number"
                    value={settings.maxFileSize}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allowed File Types
                  </label>
                  <input
                    type="text"
                    value={settings.allowedFileTypes.join(', ')}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enableAuditLogging}
                    readOnly
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Enable Audit Logging</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enableEncryption}
                    readOnly
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Enable Data Encryption</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enableExportLogging}
                    readOnly
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Enable Export Logging</label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;