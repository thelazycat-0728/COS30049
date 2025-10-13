// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, TouchableOpacity } from 'react-native';

const ProfileScreen = () => {
  const [user, setUser] = useState(null);
  const [observations, setObservations] = useState([]);

  // Mock user data and observations
  useEffect(() => {
    const mockUser = {
      name: 'Plant Lover',
      username: '@plantlover',
      bio: 'Nature enthusiast passionate about documenting every plant I encounter',
      joinDate: 'Joined January 2023',
      stats: {
        observations: 24,
        species: 18,
        locations: 8
      }
    };

    const mockObservations = [
      {
        id: '1',
        name: 'Sunflower',
        scientificName: 'Helianthus annuus',
        date: '2024-01-15',
        location: 'Community Garden',
        image: 'https://via.placeholder.com/100'
      },
      {
        id: '2',
        name: 'Oak Tree',
        scientificName: 'Quercus',
        date: '2024-01-10',
        location: 'Forest Park',
        image: 'https://via.placeholder.com/100'
      },
      {
        id: '3',
        name: 'Rose',
        scientificName: 'Rosa rugosa',
        date: '2024-01-08',
        location: 'Botanical Garden',
        image: 'https://via.placeholder.com/100'
      },
      {
        id: '4',
        name: 'Maple Tree',
        scientificName: 'Acer',
        date: '2024-01-05',
        location: 'City Park',
        image: 'https://via.placeholder.com/100'
      }
    ];

    setUser(mockUser);
    setObservations(mockObservations);
  }, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* User Header */}
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://via.placeholder.com/100' }} 
          style={styles.avatar}
        />
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.bio}>{user.bio}</Text>
        <Text style={styles.joinDate}>{user.joinDate}</Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.stats.observations}</Text>
          <Text style={styles.statLabel}>Observations</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.stats.species}</Text>
          <Text style={styles.statLabel}>Species</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.stats.locations}</Text>
          <Text style={styles.statLabel}>Locations</Text>
        </View>
      </View>

      {/* Observations List */}
      <View style={styles.observationsSection}>
        <Text style={styles.sectionTitle}>My Observations</Text>
        {observations.map(observation => (
          <TouchableOpacity key={observation.id} style={styles.observationCard}>
            <Image 
              source={{ uri: observation.image }} 
              style={styles.observationImage}
            />
            <View style={styles.observationInfo}>
              <Text style={styles.plantName}>{observation.name}</Text>
              <Text style={styles.scientificName}>{observation.scientificName}</Text>
              <Text style={styles.observationDetails}>
                {observation.location} • {observation.date}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  username: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  joinDate: {
    fontSize: 12,
    color: '#999',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  observationsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  observationCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  observationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  observationInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  plantName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scientificName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginVertical: 2,
  },
  observationDetails: {
    fontSize: 12,
    color: '#999',
  },
});

export default ProfileScreen;