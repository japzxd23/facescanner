import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonItem,
  IonLabel,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonModal,
  IonGrid,
  IonRow,
  IonCol,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonPopover,
  IonFab,
  IonFabButton
} from '@ionic/react';
import {
  arrowBack,
  time,
  person,
  analytics,
  calendar,
  funnel,
  download,
  statsChart,
  eye,
  search,
  people,
  today,
  barChart,
  pieChart,
  refresh
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { getAttendanceLogs, AttendanceLog, getCurrentUser, getMembers } from '../services/supabaseClient';

interface AttendanceStats {
  totalScans: number;
  uniqueMembers: number;
  todayScans: number;
  weeklyScans: number;
  monthlyScans: number;
  averageConfidence: number;
  topMember: { name: string; count: number } | null;
  busyHour: { hour: string; count: number } | null;
  memberStatusBreakdown: { [key: string]: number };
  dailyTrend: Array<{ date: string; count: number }>;
  hourlyPattern: Array<{ hour: number; count: number }>;
}

const AttendanceLogs: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const history = useHistory();

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchText, selectedMember, selectedStatus, dateFilter, customDateRange]);

  useEffect(() => {
    if (logs.length > 0) {
      calculateStats();
    }
  }, [filteredLogs]);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        history.push('/admin/login');
      }
    } catch (error) {
      history.push('/admin/login');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, membersData] = await Promise.all([
        getAttendanceLogs(1000), // Get more logs for better statistics
        getMembers()
      ]);

      setLogs(logsData);
      setMembers(membersData.map(m => ({ id: m.id, name: m.name })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchText) {
      filtered = filtered.filter(log =>
        log.member?.name?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Member filter
    if (selectedMember !== 'all') {
      filtered = filtered.filter(log => log.member?.id === selectedMember);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(log => log.member?.status === selectedStatus);
    }

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(log => new Date(log.timestamp) >= today);
        break;
      case 'yesterday':
        filtered = filtered.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= yesterday && logDate < today;
        });
        break;
      case 'week':
        filtered = filtered.filter(log => new Date(log.timestamp) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(log => new Date(log.timestamp) >= monthAgo);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          const startDate = new Date(customDateRange.start);
          const endDate = new Date(customDateRange.end);
          endDate.setHours(23, 59, 59, 999); // Include full end date
          filtered = filtered.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= startDate && logDate <= endDate;
          });
        }
        break;
    }

    setFilteredLogs(filtered);
  };

  const calculateStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Basic stats
    const totalScans = filteredLogs.length;
    const uniqueMembers = new Set(filteredLogs.map(log => log.member?.id).filter(Boolean)).size;
    const todayScans = filteredLogs.filter(log => new Date(log.timestamp) >= today).length;
    const weeklyScans = filteredLogs.filter(log => new Date(log.timestamp) >= weekAgo).length;
    const monthlyScans = filteredLogs.filter(log => new Date(log.timestamp) >= monthAgo).length;

    // Average confidence
    const averageConfidence = filteredLogs.length > 0
      ? filteredLogs.reduce((sum, log) => sum + (log.confidence || 0), 0) / filteredLogs.length
      : 0;

    // Member frequency
    const memberCounts: { [key: string]: { name: string; count: number } } = {};
    filteredLogs.forEach(log => {
      if (log.member?.id && log.member?.name) {
        if (!memberCounts[log.member.id]) {
          memberCounts[log.member.id] = { name: log.member.name, count: 0 };
        }
        memberCounts[log.member.id].count++;
      }
    });

    const topMember = Object.values(memberCounts).length > 0
      ? Object.values(memberCounts).reduce((max, current) => current.count > max.count ? current : max)
      : null;

    // Status breakdown
    const memberStatusBreakdown: { [key: string]: number } = {};
    filteredLogs.forEach(log => {
      const status = log.member?.status || 'Unknown';
      memberStatusBreakdown[status] = (memberStatusBreakdown[status] || 0) + 1;
    });

    // Hourly pattern
    const hourlyCounts: { [key: number]: number } = {};
    filteredLogs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });

    const hourlyPattern = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyCounts[hour] || 0
    }));

    const busyHour = Object.entries(hourlyCounts).length > 0
      ? Object.entries(hourlyCounts).reduce((max, [hour, count]) =>
          count > max.count ? { hour: `${hour}:00`, count } : max,
          { hour: '0:00', count: 0 }
        )
      : null;

    // Daily trend (last 30 days)
    const dailyTrend: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = filteredLogs.filter(log =>
        log.timestamp.startsWith(dateStr)
      ).length;
      dailyTrend.push({ date: dateStr, count });
    }

    setStats({
      totalScans,
      uniqueMembers,
      todayScans,
      weeklyScans,
      monthlyScans,
      averageConfidence,
      topMember,
      busyHour,
      memberStatusBreakdown,
      dailyTrend,
      hourlyPattern
    });
  };

  const exportData = () => {
    const headers = ['Date', 'Time', 'Member Name', 'Status', 'Confidence'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => {
        const date = new Date(log.timestamp);
        return [
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          log.member?.name || 'Unknown',
          log.member?.status || 'Unknown',
          `${((log.confidence || 0) * 100).toFixed(1)}%`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const refresh = async (event: any) => {
    await loadData();
    event.detail.complete();
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VIP': return 'tertiary';
      case 'Banned': return 'danger';
      case 'Allowed': return 'success';
      default: return 'medium';
    }
  };

  const groupLogsByDate = (logs: AttendanceLog[]) => {
    const grouped: { [key: string]: AttendanceLog[] } = {};

    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(log);
    });

    return grouped;
  };

  const renderStatsView = () => {
    if (!stats) return null;

    return (
      <div style={{ padding: '24px' }}>
        {/* Key Metrics */}
        <IonGrid>
          <IonRow>
            <IonCol size="6" sizeMd="3">
              <IonCard className="enterprise-card">
                <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                  <IonIcon icon={analytics} style={{ fontSize: '40px', color: 'var(--ion-color-primary)', marginBottom: '12px' }} />
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {stats.totalScans}
                  </h2>
                  <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Total Scans
                  </p>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="6" sizeMd="3">
              <IonCard className="enterprise-card">
                <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                  <IonIcon icon={people} style={{ fontSize: '40px', color: 'var(--ion-color-success)', marginBottom: '12px' }} />
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {stats.uniqueMembers}
                  </h2>
                  <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Unique Members
                  </p>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="6" sizeMd="3">
              <IonCard className="enterprise-card">
                <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                  <IonIcon icon={today} style={{ fontSize: '40px', color: 'var(--ion-color-warning)', marginBottom: '12px' }} />
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {stats.todayScans}
                  </h2>
                  <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Today's Scans
                  </p>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="6" sizeMd="3">
              <IonCard className="enterprise-card">
                <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                  <IonIcon icon={statsChart} style={{ fontSize: '40px', color: 'var(--ion-color-tertiary)', marginBottom: '12px' }} />
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '28px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {(stats.averageConfidence * 100).toFixed(1)}%
                  </h2>
                  <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Avg Confidence
                  </p>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Additional Stats */}
        <IonGrid>
          <IonRow>
            <IonCol size="12" sizeMd="6">
              <IonCard className="enterprise-card">
                <IonCardHeader>
                  <IonCardTitle style={{ color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>
                    📊 Quick Insights
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--ion-color-medium)', fontFamily: 'Inter, system-ui, sans-serif' }}>Weekly Scans:</span>
                      <span style={{ fontWeight: '600', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>{stats.weeklyScans}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--ion-color-medium)', fontFamily: 'Inter, system-ui, sans-serif' }}>Monthly Scans:</span>
                      <span style={{ fontWeight: '600', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>{stats.monthlyScans}</span>
                    </div>
                    {stats.topMember && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--ion-color-medium)', fontFamily: 'Inter, system-ui, sans-serif' }}>Most Active:</span>
                        <span style={{ fontWeight: '600', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                          {stats.topMember.name} ({stats.topMember.count})
                        </span>
                      </div>
                    )}
                    {stats.busyHour && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--ion-color-medium)', fontFamily: 'Inter, system-ui, sans-serif' }}>Busiest Hour:</span>
                        <span style={{ fontWeight: '600', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                          {stats.busyHour.hour} ({stats.busyHour.count} scans)
                        </span>
                      </div>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="12" sizeMd="6">
              <IonCard className="enterprise-card">
                <IonCardHeader>
                  <IonCardTitle style={{ color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>
                    👥 Member Status Breakdown
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(stats.memberStatusBreakdown).map(([status, count]) => {
                      const percentage = ((count / stats.totalScans) * 100).toFixed(1);
                      return (
                        <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IonBadge color={getStatusColor(status)} style={{ fontSize: '12px' }}>
                              {status}
                            </IonBadge>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                              {count} ({percentage}%)
                            </span>
                            <div style={{
                              width: '60px',
                              height: '8px',
                              background: 'var(--enterprise-border-medium)',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: `var(--ion-color-${getStatusColor(status)})`,
                                borderRadius: '4px'
                              }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Daily Trend Chart */}
        <IonCard className="enterprise-card">
          <IonCardHeader>
            <IonCardTitle style={{ color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>
              📈 Daily Activity Trend (Last 30 Days)
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '120px', overflow: 'auto' }}>
              {stats.dailyTrend.map((day, index) => {
                const maxCount = Math.max(...stats.dailyTrend.map(d => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={index}
                    style={{
                      minWidth: '20px',
                      height: `${height}%`,
                      background: day.count > 0 ? 'var(--ion-color-primary)' : 'var(--enterprise-border-medium)',
                      borderRadius: '2px 2px 0 0',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'end',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                    title={`${new Date(day.date).toLocaleDateString()}: ${day.count} scans`}
                  >
                    {day.count > 0 && (
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        fontSize: '8px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {day.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </IonCardContent>
        </IonCard>
      </div>
    );
  };

  const renderListView = () => {
    const groupedLogs = groupLogsByDate(filteredLogs);

    return (
      <div style={{ padding: '24px' }}>
        {/* Filters */}
        <IonCard className="enterprise-card">
          <IonCardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <IonSearchbar
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder="Search members..."
                style={{
                  '--background': 'var(--enterprise-surface-secondary)',
                  '--border-radius': 'var(--enterprise-radius-md)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <IonSelect
                  value={selectedMember}
                  onSelectionChange={(e) => setSelectedMember(e.detail.value)}
                  placeholder="All Members"
                  style={{
                    '--background': 'var(--enterprise-surface-secondary)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  <IonSelectOption value="all">All Members</IonSelectOption>
                  {members.map(member => (
                    <IonSelectOption key={member.id} value={member.id}>
                      {member.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>

                <IonSelect
                  value={selectedStatus}
                  onSelectionChange={(e) => setSelectedStatus(e.detail.value)}
                  placeholder="All Statuses"
                  style={{
                    '--background': 'var(--enterprise-surface-secondary)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  <IonSelectOption value="all">All Statuses</IonSelectOption>
                  <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                  <IonSelectOption value="VIP">VIP</IonSelectOption>
                  <IonSelectOption value="Banned">Banned</IonSelectOption>
                </IonSelect>

                <IonSelect
                  value={dateFilter}
                  onSelectionChange={(e) => setDateFilter(e.detail.value)}
                  placeholder="All Time"
                  style={{
                    '--background': 'var(--enterprise-surface-secondary)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  <IonSelectOption value="all">All Time</IonSelectOption>
                  <IonSelectOption value="today">Today</IonSelectOption>
                  <IonSelectOption value="yesterday">Yesterday</IonSelectOption>
                  <IonSelectOption value="week">Last 7 Days</IonSelectOption>
                  <IonSelectOption value="month">Last 30 Days</IonSelectOption>
                  <IonSelectOption value="custom">Custom Range</IonSelectOption>
                </IonSelect>
              </div>

              {dateFilter === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <IonDatetime
                    value={customDateRange.start}
                    onIonChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.detail.value as string }))}
                    presentation="date"
                    placeholder="Start Date"
                    style={{
                      '--background': 'var(--enterprise-surface-secondary)',
                      '--border-radius': 'var(--enterprise-radius-md)'
                    }}
                  />
                  <IonDatetime
                    value={customDateRange.end}
                    onIonChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.detail.value as string }))}
                    presentation="date"
                    placeholder="End Date"
                    style={{
                      '--background': 'var(--enterprise-surface-secondary)',
                      '--border-radius': 'var(--enterprise-radius-md)'
                    }}
                  />
                </div>
              )}
            </div>
          </IonCardContent>
        </IonCard>

        {/* Results Summary */}
        <IonCard className="enterprise-card">
          <IonCardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>
                  {filteredLogs.length} Records Found
                </h3>
                <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {filteredLogs.length !== logs.length && `Filtered from ${logs.length} total records`}
                </p>
              </div>
              <IonButton
                fill="outline"
                onClick={exportData}
                disabled={filteredLogs.length === 0}
                style={{
                  '--border-radius': 'var(--enterprise-radius-md)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '600',
                  textTransform: 'none'
                }}
              >
                <IonIcon icon={download} slot="start" />
                Export CSV
              </IonButton>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Logs grouped by date */}
        {Object.keys(groupedLogs)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map(date => (
            <div key={date}>
              <div style={{
                padding: '20px 0 16px 0',
                borderBottom: '1px solid var(--enterprise-border-subtle)',
                marginBottom: '16px'
              }}>
                <h4 style={{
                  margin: 0,
                  color: 'var(--ion-text-color)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '600',
                  fontSize: '18px'
                }}>
                  📅 {date} ({groupedLogs[date].length} scans)
                </h4>
              </div>

              {groupedLogs[date]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map(log => {
                  const dateTime = formatDateTime(log.timestamp);
                  return (
                    <IonCard key={log.id} className="enterprise-card">
                      <IonCardContent style={{ padding: '20px' }}>
                        <IonItem lines="none" style={{ '--padding-start': '0', '--background': 'transparent' }}>
                          <div slot="start" style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: 'var(--enterprise-surface-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid var(--enterprise-border-subtle)'
                          }}>
                            <IonIcon icon={person} style={{ fontSize: '28px', color: 'var(--ion-color-primary)' }} />
                          </div>

                          <IonLabel style={{ marginLeft: '16px' }}>
                            <h3 style={{
                              color: 'var(--ion-text-color)',
                              fontFamily: 'Inter, system-ui, sans-serif',
                              fontWeight: '600',
                              fontSize: '18px',
                              margin: '0 0 8px 0'
                            }}>
                              {log.member?.name || 'Unknown Member'}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <IonIcon icon={time} style={{ fontSize: '16px', color: 'var(--ion-color-medium)' }} />
                                <span style={{
                                  color: 'var(--ion-color-medium)',
                                  fontSize: '14px',
                                  fontFamily: 'Inter, system-ui, sans-serif'
                                }}>
                                  {dateTime.time}
                                </span>
                              </div>
                              <div style={{
                                color: 'var(--ion-color-medium)',
                                fontSize: '14px',
                                fontFamily: 'Inter, system-ui, sans-serif'
                              }}>
                                Confidence: <span style={{ fontWeight: '600', color: 'var(--ion-text-color)' }}>
                                  {(log.confidence * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </IonLabel>

                          <div slot="end">
                            <IonBadge
                              color={getStatusColor(log.member?.status || '')}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '16px',
                                fontSize: '12px',
                                fontWeight: '600',
                                fontFamily: 'Inter, system-ui, sans-serif'
                              }}
                            >
                              {log.member?.status || 'Unknown'}
                            </IonBadge>
                          </div>
                        </IonItem>
                      </IonCardContent>
                    </IonCard>
                  );
                })
              }
            </div>
          ))
        }

        {filteredLogs.length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--ion-color-medium)'
          }}>
            <IonIcon
              icon={analytics}
              style={{ fontSize: '64px', marginBottom: '24px', opacity: 0.3 }}
            />
            <h3 style={{
              color: 'var(--ion-text-color)',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: '600'
            }}>
              No attendance logs found
            </h3>
            <p style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              {logs.length === 0
                ? 'Logs will appear here as members are scanned'
                : 'Try adjusting your filters to see more results'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{
          '--background': 'var(--enterprise-surface-primary)',
          '--color': 'var(--ion-text-color)',
          '--border-color': 'var(--enterprise-border-subtle)',
          borderBottom: '1px solid var(--enterprise-border-subtle)'
        }}>
          <IonButton
            slot="start"
            fill="clear"
            onClick={() => history.goBack()}
            style={{ '--color': 'var(--ion-color-primary)' }}
          >
            <IonIcon icon={arrowBack} />
          </IonButton>
          <IonTitle style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: '600',
            color: 'var(--ion-text-color)'
          }}>
            Attendance Analytics
          </IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={() => loadData()}
            style={{ '--color': 'var(--ion-color-primary)' }}
          >
            <IonIcon icon={refresh} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* View Mode Selector */}
        <div style={{ padding: '24px 24px 0 24px' }}>
          <IonSegment
            value={viewMode}
            onIonChange={(e) => setViewMode(e.detail.value as 'list' | 'stats')}
            style={{
              '--background': 'var(--enterprise-surface-primary)',
              borderRadius: 'var(--enterprise-radius-lg)',
              border: '1px solid var(--enterprise-border-subtle)'
            }}
          >
            <IonSegmentButton value="stats" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IonIcon icon={statsChart} />
              <IonLabel>Statistics</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="list" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IonIcon icon={eye} />
              <IonLabel>Logs</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonSpinner style={{ fontSize: '48px' }} />
            <p style={{
              marginTop: '16px',
              color: 'var(--ion-color-medium)',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Loading attendance data...
            </p>
          </div>
        )}

        {!loading && (viewMode === 'stats' ? renderStatsView() : renderListView())}

        {/* Floating Export Button */}
        {viewMode === 'list' && filteredLogs.length > 0 && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton color="primary" onClick={exportData}>
              <IonIcon icon={download} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AttendanceLogs;