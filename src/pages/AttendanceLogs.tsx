import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonItem,
  IonLabel
} from '@ionic/react';
import { arrowBack, time, person } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { getAttendanceLogs, AttendanceLog, getCurrentUser } from '../services/supabaseClient';

const AttendanceLogs: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  useEffect(() => {
    checkAuth();
    loadLogs();
  }, []);

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

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceLogs(100);
      setLogs(data);
    } catch (error) {
      console.error('Error loading attendance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (event: any) => {
    await loadLogs();
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

  const groupedLogs = groupLogsByDate(logs);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton
            slot="start"
            fill="clear"
            onClick={() => history.goBack()}
          >
            <IonIcon icon={arrowBack} />
          </IonButton>
          <IonTitle>Attendance Logs</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '10px' }}>
          {/* Summary Card */}
          <IonCard className="clean-card">
            <IonCardContent>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0' }}>Total Scans</h2>
                  <IonText color="medium">
                    {logs.length} entries
                  </IonText>
                </div>
                <IonIcon 
                  icon={analytics} 
                  style={{ fontSize: '2.5em', color: '#3b82f6' }}
                />
              </div>
            </IonCardContent>
          </IonCard>

          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <IonSpinner />
            </div>
          )}

          {/* Logs grouped by date */}
          {Object.keys(groupedLogs)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map(date => (
              <div key={date}>
                <div style={{
                  padding: '15px 5px 10px 5px',
                  borderBottom: '1px solid #e0e0e0',
                  marginBottom: '10px'
                }}>
                  <IonText color="medium">
                    <strong>{date}</strong>
                  </IonText>
                </div>

                {groupedLogs[date]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(log => {
                    const dateTime = formatDateTime(log.timestamp);
                    return (
                      <IonCard key={log.id} className="admin-card">
                        <IonCardContent>
                          <IonItem lines="none" style={{ '--padding-start': '0' }}>
                            <div slot="start" style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              background: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <IonIcon icon={person} style={{ fontSize: '1.5em' }} />
                            </div>
                            
                            <IonLabel>
                              <h3>{log.member?.name || 'Unknown Member'}</h3>
                              <p>
                                <IonIcon icon={time} style={{ marginRight: '5px' }} />
                                {dateTime.time}
                              </p>
                              <p>Confidence: {(log.confidence * 100).toFixed(1)}%</p>
                            </IonLabel>
                            
                            <div slot="end">
                              <IonBadge
                                color={getStatusColor(log.member?.status || '')}
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

          {logs.length === 0 && !loading && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#666'
            }}>
              <IonIcon 
                icon={analytics}
                style={{ fontSize: '3em', marginBottom: '20px', opacity: 0.3 }}
              />
              <h3>No attendance logs yet</h3>
              <p>Logs will appear here as members are scanned</p>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AttendanceLogs;