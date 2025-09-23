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
  IonFab,
  IonFabButton,
  IonModal,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonGrid,
  IonRow,
  IonCol,
  IonActionSheet,
  IonPopover,
  IonList,
  IonToggle
} from '@ionic/react';
import {
  arrowBack,
  personAdd,
  person,
  create,
  trash,
  search,
  funnel,
  ellipsisVertical,
  checkmarkCircle,
  closeCircle,
  star,
  ban,
  save,
  close
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { getMembers, addMember, updateMember, deleteMember, getCurrentUser, Member } from '../services/supabaseClient';

const MemberManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Allowed' as 'Allowed' | 'VIP' | 'Banned'
  });
  const [editMember, setEditMember] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    status: 'Allowed' as 'Allowed' | 'VIP' | 'Banned'
  });

  const history = useHistory();

  useEffect(() => {
    checkAuth();
    loadMembers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [members, searchText, statusFilter]);

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

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
      setAlertMessage('Failed to load members. Please try again.');
      setAlertHeader('Error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...members];

    // Search filter
    if (searchText) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchText.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchText.toLowerCase()) ||
        member.phone?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }

    setFilteredMembers(filtered);
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) {
      setAlertMessage('Please enter a member name');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return;
    }

    if (newMember.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMember.email)) {
      setAlertMessage('Please enter a valid email address');
      setAlertHeader('Invalid Email');
      setShowAlert(true);
      return;
    }

    setLoading(true);
    try {
      await addMember({
        name: newMember.name.trim(),
        email: newMember.email.trim() || null,
        phone: newMember.phone.trim() || null,
        status: newMember.status
      });

      setNewMember({ name: '', email: '', phone: '', status: 'Allowed' });
      setShowAddModal(false);
      await loadMembers();

      setAlertMessage('Member added successfully!');
      setAlertHeader('Success');
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error adding member:', error);
      setAlertMessage(error.message || 'Failed to add member. Please try again.');
      setAlertHeader('Error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = async () => {
    if (!editMember.name.trim()) {
      setAlertMessage('Please enter a member name');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return;
    }

    if (editMember.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editMember.email)) {
      setAlertMessage('Please enter a valid email address');
      setAlertHeader('Invalid Email');
      setShowAlert(true);
      return;
    }

    setLoading(true);
    try {
      await updateMember(editMember.id, {
        name: editMember.name.trim(),
        email: editMember.email.trim() || null,
        phone: editMember.phone.trim() || null,
        status: editMember.status
      });

      setShowEditModal(false);
      setSelectedMember(null);
      await loadMembers();

      setAlertMessage('Member updated successfully!');
      setAlertHeader('Success');
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error updating member:', error);
      setAlertMessage(error.message || 'Failed to update member. Please try again.');
      setAlertHeader('Error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    setLoading(true);
    try {
      await deleteMember(selectedMember.id);
      setShowDeleteAlert(false);
      setSelectedMember(null);
      await loadMembers();

      setAlertMessage('Member deleted successfully!');
      setAlertHeader('Success');
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      setAlertMessage(error.message || 'Failed to delete member. Please try again.');
      setAlertHeader('Error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (member: Member) => {
    setEditMember({
      id: member.id,
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      status: member.status
    });
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const openDeleteConfirm = (member: Member) => {
    setSelectedMember(member);
    setShowDeleteAlert(true);
  };

  const handleQuickStatusChange = async (member: Member, newStatus: 'Allowed' | 'VIP' | 'Banned') => {
    setLoading(true);
    try {
      await updateMember(member.id, { status: newStatus });
      await loadMembers();

      setAlertMessage(`${member.name} status changed to ${newStatus}`);
      setAlertHeader('Status Updated');
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error updating status:', error);
      setAlertMessage(error.message || 'Failed to update status. Please try again.');
      setAlertHeader('Error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (event: any) => {
    await loadMembers();
    event.detail.complete();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VIP': return 'tertiary';
      case 'Banned': return 'danger';
      case 'Allowed': return 'success';
      default: return 'medium';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VIP': return star;
      case 'Banned': return ban;
      case 'Allowed': return checkmarkCircle;
      default: return person;
    }
  };

  const getMemberStats = () => {
    const total = members.length;
    const allowed = members.filter(m => m.status === 'Allowed').length;
    const vip = members.filter(m => m.status === 'VIP').length;
    const banned = members.filter(m => m.status === 'Banned').length;
    const withFaceData = members.filter(m => m.face_embedding && m.face_embedding.length > 0).length;

    return { total, allowed, vip, banned, withFaceData };
  };

  const stats = getMemberStats();

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
            Member Management
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '24px' }}>
          {/* Statistics Cards */}
          <IonGrid>
            <IonRow>
              <IonCol size="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={person} style={{ fontSize: '32px', color: 'var(--ion-color-primary)', marginBottom: '8px' }} />
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {stats.total}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      Total Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={checkmarkCircle} style={{ fontSize: '32px', color: 'var(--ion-color-success)', marginBottom: '8px' }} />
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {stats.allowed}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      Allowed
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={star} style={{ fontSize: '32px', color: 'var(--ion-color-tertiary)', marginBottom: '8px' }} />
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {stats.vip}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      VIP Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={ban} style={{ fontSize: '32px', color: 'var(--ion-color-danger)', marginBottom: '8px' }} />
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {stats.banned}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      Banned
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Search and Filters */}
          <IonCard className="enterprise-card">
            <IonCardContent style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <IonSearchbar
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value!)}
                  placeholder="Search members by name, email, or phone..."
                  style={{
                    '--background': 'var(--enterprise-surface-secondary)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                />

                <IonSelect
                  value={statusFilter}
                  onSelectionChange={(e) => setStatusFilter(e.detail.value)}
                  placeholder="Filter by Status"
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
              </div>
            </IonCardContent>
          </IonCard>

          {/* Results Summary */}
          <IonCard className="enterprise-card">
            <IonCardContent style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: 'var(--ion-text-color)', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>
                    {filteredMembers.length} Members
                  </h3>
                  <p style={{ margin: 0, color: 'var(--ion-color-medium)', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {stats.withFaceData} with face data registered
                  </p>
                </div>
                <IonBadge
                  color="primary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  {((stats.withFaceData / stats.total) * 100).toFixed(0)}% Enrolled
                </IonBadge>
              </div>
            </IonCardContent>
          </IonCard>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <IonSpinner style={{ fontSize: '48px' }} />
              <p style={{
                marginTop: '16px',
                color: 'var(--ion-color-medium)',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                Loading members...
              </p>
            </div>
          )}

          {/* Members List */}
          {!loading && filteredMembers.map(member => (
            <IonCard key={member.id} className="enterprise-card">
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
                    <IonIcon icon={getStatusIcon(member.status)} style={{ fontSize: '28px', color: `var(--ion-color-${getStatusColor(member.status)})` }} />
                  </div>

                  <IonLabel style={{ marginLeft: '16px' }}>
                    <h3 style={{
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontWeight: '600',
                      fontSize: '18px',
                      margin: '0 0 8px 0'
                    }}>
                      {member.name}
                    </h3>
                    {member.email && (
                      <p style={{
                        color: 'var(--ion-color-medium)',
                        fontSize: '14px',
                        margin: '0 0 4px 0',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        📧 {member.email}
                      </p>
                    )}
                    {member.phone && (
                      <p style={{
                        color: 'var(--ion-color-medium)',
                        fontSize: '14px',
                        margin: '0 0 4px 0',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        📱 {member.phone}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                      <IonBadge
                        color={getStatusColor(member.status)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}
                      >
                        {member.status}
                      </IonBadge>
                      {member.face_embedding && member.face_embedding.length > 0 && (
                        <IonBadge
                          color="success"
                          style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            fontFamily: 'Inter, system-ui, sans-serif'
                          }}
                        >
                          Face Enrolled
                        </IonBadge>
                      )}
                    </div>
                  </IonLabel>

                  <div slot="end" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Quick Status Change Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {member.status !== 'Allowed' && (
                        <IonButton
                          size="small"
                          fill="clear"
                          color="success"
                          onClick={() => handleQuickStatusChange(member, 'Allowed')}
                          title="Set as Allowed"
                        >
                          <IonIcon icon={checkmarkCircle} />
                        </IonButton>
                      )}
                      {member.status !== 'VIP' && (
                        <IonButton
                          size="small"
                          fill="clear"
                          color="tertiary"
                          onClick={() => handleQuickStatusChange(member, 'VIP')}
                          title="Set as VIP"
                        >
                          <IonIcon icon={star} />
                        </IonButton>
                      )}
                      {member.status !== 'Banned' && (
                        <IonButton
                          size="small"
                          fill="clear"
                          color="danger"
                          onClick={() => handleQuickStatusChange(member, 'Banned')}
                          title="Ban Member"
                        >
                          <IonIcon icon={ban} />
                        </IonButton>
                      )}
                    </div>

                    {/* Edit/Delete Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <IonButton
                        size="small"
                        fill="clear"
                        color="primary"
                        onClick={() => openEditModal(member)}
                      >
                        <IonIcon icon={create} />
                      </IonButton>
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => openDeleteConfirm(member)}
                      >
                        <IonIcon icon={trash} />
                      </IonButton>
                    </div>
                  </div>
                </IonItem>
              </IonCardContent>
            </IonCard>
          ))}

          {!loading && filteredMembers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: 'var(--ion-color-medium)'
            }}>
              <IonIcon
                icon={person}
                style={{ fontSize: '64px', marginBottom: '24px', opacity: 0.3 }}
              />
              <h3 style={{
                color: 'var(--ion-text-color)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '600'
              }}>
                No members found
              </h3>
              <p style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {members.length === 0
                  ? 'Add your first member to get started'
                  : 'Try adjusting your search or filters'
                }
              </p>
            </div>
          )}
        </div>

        {/* Add Member FAB */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton color="primary" onClick={() => setShowAddModal(true)}>
            <IonIcon icon={personAdd} />
          </IonFabButton>
        </IonFab>

        {/* Add Member Modal */}
        <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
          <IonHeader>
            <IonToolbar style={{
              '--background': 'var(--enterprise-surface-primary)',
              '--color': 'var(--ion-text-color)'
            }}>
              <IonTitle style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '600'
              }}>
                Add New Member
              </IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                onClick={() => setShowAddModal(false)}
                style={{ '--color': 'var(--ion-color-medium)' }}
              >
                <IonIcon icon={close} />
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
            <div style={{ padding: '24px' }}>
              <IonCard className="enterprise-card">
                <IonCardContent style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Full Name *
                      </IonLabel>
                      <IonInput
                        value={newMember.name}
                        onIonInput={(e) => setNewMember(prev => ({ ...prev, name: e.detail.value! }))}
                        placeholder="Enter member's full name"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Email Address
                      </IonLabel>
                      <IonInput
                        type="email"
                        value={newMember.email}
                        onIonInput={(e) => setNewMember(prev => ({ ...prev, email: e.detail.value! }))}
                        placeholder="Enter email address (optional)"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Phone Number
                      </IonLabel>
                      <IonInput
                        type="tel"
                        value={newMember.phone}
                        onIonInput={(e) => setNewMember(prev => ({ ...prev, phone: e.detail.value! }))}
                        placeholder="Enter phone number (optional)"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Status
                      </IonLabel>
                      <IonSelect
                        value={newMember.status}
                        onSelectionChange={(e) => setNewMember(prev => ({ ...prev, status: e.detail.value }))}
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      >
                        <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                        <IonSelectOption value="VIP">VIP</IonSelectOption>
                        <IonSelectOption value="Banned">Banned</IonSelectOption>
                      </IonSelect>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <IonButton
                        expand="block"
                        color="primary"
                        onClick={handleAddMember}
                        disabled={loading || !newMember.name.trim()}
                        style={{
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontWeight: '600',
                          textTransform: 'none',
                          flex: 1
                        }}
                      >
                        <IonIcon icon={save} slot="start" />
                        Add Member
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={() => setShowAddModal(false)}
                        style={{
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontWeight: '600',
                          textTransform: 'none',
                          flex: 1
                        }}
                      >
                        Cancel
                      </IonButton>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </div>
          </IonContent>
        </IonModal>

        {/* Edit Member Modal */}
        <IonModal isOpen={showEditModal} onDidDismiss={() => setShowEditModal(false)}>
          <IonHeader>
            <IonToolbar style={{
              '--background': 'var(--enterprise-surface-primary)',
              '--color': 'var(--ion-text-color)'
            }}>
              <IonTitle style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '600'
              }}>
                Edit Member
              </IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                onClick={() => setShowEditModal(false)}
                style={{ '--color': 'var(--ion-color-medium)' }}
              >
                <IonIcon icon={close} />
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
            <div style={{ padding: '24px' }}>
              <IonCard className="enterprise-card">
                <IonCardContent style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Full Name *
                      </IonLabel>
                      <IonInput
                        value={editMember.name}
                        onIonInput={(e) => setEditMember(prev => ({ ...prev, name: e.detail.value! }))}
                        placeholder="Enter member's full name"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Email Address
                      </IonLabel>
                      <IonInput
                        type="email"
                        value={editMember.email}
                        onIonInput={(e) => setEditMember(prev => ({ ...prev, email: e.detail.value! }))}
                        placeholder="Enter email address (optional)"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Phone Number
                      </IonLabel>
                      <IonInput
                        type="tel"
                        value={editMember.phone}
                        onIonInput={(e) => setEditMember(prev => ({ ...prev, phone: e.detail.value! }))}
                        placeholder="Enter phone number (optional)"
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          '--padding-start': '16px',
                          '--padding-end': '16px',
                          '--padding-top': '12px',
                          '--padding-bottom': '12px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <IonLabel style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Status
                      </IonLabel>
                      <IonSelect
                        value={editMember.status}
                        onSelectionChange={(e) => setEditMember(prev => ({ ...prev, status: e.detail.value }))}
                        style={{
                          '--background': 'var(--enterprise-surface-secondary)',
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          marginTop: '8px'
                        }}
                      >
                        <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                        <IonSelectOption value="VIP">VIP</IonSelectOption>
                        <IonSelectOption value="Banned">Banned</IonSelectOption>
                      </IonSelect>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <IonButton
                        expand="block"
                        color="primary"
                        onClick={handleEditMember}
                        disabled={loading || !editMember.name.trim()}
                        style={{
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontWeight: '600',
                          textTransform: 'none',
                          flex: 1
                        }}
                      >
                        <IonIcon icon={save} slot="start" />
                        Save Changes
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        onClick={() => setShowEditModal(false)}
                        style={{
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontWeight: '600',
                          textTransform: 'none',
                          flex: 1
                        }}
                      >
                        Cancel
                      </IonButton>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </div>
          </IonContent>
        </IonModal>

        {/* Delete Confirmation Alert */}
        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete Member"
          message={`Are you sure you want to delete ${selectedMember?.name}? This action cannot be undone.`}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: handleDeleteMember
            }
          ]}
        />

        {/* General Alert */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default MemberManagement;