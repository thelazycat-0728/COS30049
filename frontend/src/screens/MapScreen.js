import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  Modal,
  Image,
  ScrollView,
  AccessibilityInfo,
  Platform,
  Pressable,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from "react-native-maps";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Resolve image URL: accept absolute URLs and backend-relative paths like "/uploads/xyz.jpg"
const resolveImageUrl = (url) => {
  if (url) {
    return url.startsWith("http") ? url : `${API_BASE}${url}`;
  }
};

const MapScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");
  const mapRef = useRef(null);
  const ALL_STATUSES = [
    "least_concern",
    "near_threatened",
    "vulnerable",
    "endangered",
    "critically_endangered",
  ];
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterFamilies, setFilterFamilies] = useState([]);
  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyDropdownVisible, setFamilyDropdownVisible] = useState(false);
  const [tempFilterFamilies, setTempFilterFamilies] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [datePreset, setDatePreset] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showPlantCard, setShowPlantCard] = useState(false);
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const [cardDims, setCardDims] = useState({ width: 280, height: 220 });
  const [cardPosition, setCardPosition] = useState({ left: 16, top: 16 });
  const [lastPinPoint, setLastPinPoint] = useState(null);
  const [locations, setLocations] = useState([]);
  const [resultsCount, setResultsCount] = useState(0);
  const [mapRegion, setMapRegion] = useState({
    latitude: -37.8136,
    longitude: 144.9631,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [pinCoords, setPinCoords] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const heatRadius = Platform.select({ ios: 120, android: 50, default: 50 });
  const heatOpacity = Platform.select({ ios: 1, android: 0.85, default: 0.85 });
  const heatGradient = Platform.select({
    ios: {
      colors: [
        "rgba(79,195,247,0)",
        "#29b6f6",
        "#0288d1",
        "#ef6c00",
        "#d84315",
        "#b71c1c",
      ],
      startPoints: [0.0, 0.05, 0.10, 0.20, 0.25, 1],
      colorMapSize: 1024,
    },
    default: {
      colors: [
        "rgba(79,195,247,0)",
        "#29b6f6",
        "#0288d1",
        "#ef6c00",
        "#d84315",
        "#b71c1c",
      ],
      startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
      colorMapSize: 256,
    },
  });
  const [densityPoints, setDensityPoints] = useState([]);
  const [densityMax, setDensityMax] = useState(1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const retrieveAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      return token;
    } catch (err) {
      console.error("Error retrieving access token:", err);
      return null;
    }
  };

  const withTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Location timeout")), ms);
      promise
        .then((v) => {
          clearTimeout(t);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(t);
          reject(e);
        });
    });

  useEffect(() => {
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== "granted") {
            return;
          }
        }
        const last = await Location.getLastKnownPositionAsync();
        const accuracy =
          Platform.OS === "android"
            ? Location.Accuracy.Balanced
            : Location.Accuracy.High;
        let loc = null;
        try {
          loc = await withTimeout(
            Location.getCurrentPositionAsync({ accuracy }),
            6000
          );
        } catch (e) {}
        const final = loc || last;
        if (!final) return;
        const region = {
          latitude: final.coords.latitude,
          longitude: final.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        if (!hasUserInteracted) {
          if (
            mapRef.current &&
            typeof mapRef.current.animateToRegion === "function"
          ) {
            mapRef.current.animateToRegion(region, 600);
          }
        }
        setMapRegion(region);
        setPinCoords({
          latitude: region.latitude,
          longitude: region.longitude,
        });
      } catch (err) {
        console.warn("Location error:", err?.message || err);
      }
    })();
  }, [hasUserInteracted]);

  // Heatmap helpers and fetching
  const formatDateISO = (dateObj) => {
    try {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return "";
    }
  };

  const getRegionBounds = (region) => {
    if (!region) return null;
    const halfLat = region.latitudeDelta / 2;
    const halfLon = region.longitudeDelta / 2;
    return {
      minLat: region.latitude - halfLat,
      maxLat: region.latitude + halfLat,
      minLon: region.longitude - halfLon,
      maxLon: region.longitude + halfLon,
    };
  };

  const fetchHeatmapDensity = async () => {
    try {
      if (!mapRegion) return;
      const params = new URLSearchParams();
      params.set("limit", "2000");
      // Align heatmap with public-only markers
      params.set("public", "1");
      const selFamiliesForHeat = Array.isArray(filterFamilies)
        ? filterFamilies.filter(Boolean)
        : [];
      if (selFamiliesForHeat.length === 1)
        params.set("family", selFamiliesForHeat[0]);
      const allowedStatuses = ALL_STATUSES;
      const selectedStatuses = filterStatuses.filter((s) =>
        allowedStatuses.includes(s)
      );
      if (selectedStatuses.length)
        params.set("conservation_status", selectedStatuses.join(","));
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (filterStartDate && dateRegex.test(filterStartDate))
        params.set("start_date", filterStartDate);
      if (filterEndDate && dateRegex.test(filterEndDate))
        params.set("end_date", filterEndDate);

      const b = getRegionBounds(mapRegion);
      if (b) {
        params.set("min_lat", String(b.minLat));
        params.set("max_lat", String(b.maxLat));
        params.set("min_lon", String(b.minLon));
        params.set("max_lon", String(b.maxLon));
      }

      const accessToken = await retrieveAccessToken();

      const url = `${API_BASE}/map/locations/density?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      const points = data?.points || [];
      const max =
        data?.max_count ||
        (points.length
          ? Math.max(...points.map((p) => p.observation_count))
          : 1);
      setDensityPoints(points);
      setDensityMax(Math.max(1, max));
    } catch (err) {
      console.error("Error fetching heatmap density:", err);
    }
  };

  // Fetch public locations (markers) from backend
  const fetchLocations = async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      const selFamilies = Array.isArray(filterFamilies)
        ? filterFamilies.filter(Boolean)
        : [];
      if (selFamilies.length === 1) params.set("family", selFamilies[0]);
      const selectedStatuses = filterStatuses.filter((s) =>
        ALL_STATUSES.includes(s)
      );
      if (selectedStatuses.length)
        params.set("conservation_status", selectedStatuses.join(","));
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (filterStartDate && dateRegex.test(filterStartDate))
        params.set("start_date", filterStartDate);
      if (filterEndDate && dateRegex.test(filterEndDate))
        params.set("end_date", filterEndDate);

      const accessToken = await retrieveAccessToken();
      const url = `${API_BASE}/map/locations/public?${params.toString()}`;
      const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        throw new Error(`Markers fetch failed: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data?.locations) ? data.locations : [];
      // Keep only items with valid coordinates
      const withCoords = list.filter(
        (loc) =>
          loc?.coordinates &&
          typeof loc.coordinates.lat === "number" &&
          typeof loc.coordinates.lon === "number"
      );
      const filteredCoords =
        selFamilies.length > 1
          ? withCoords.filter((loc) => selFamilies.includes(loc?.plant?.family))
          : withCoords;

      // Apply search filter by scientific name or family (case-insensitive)
      const q = (searchText || "").trim().toLowerCase();
      const finalFiltered = q
        ? filteredCoords.filter((loc) => {
            const sci = (loc?.plant?.scientific_name || "").toLowerCase();
            const fam = (loc?.plant?.family || "").toLowerCase();
            const common = (loc?.plant?.common_name || "").toLowerCase();
            return sci.includes(q) || fam.includes(q) || common.includes(q);
          })
        : filteredCoords;

      setLocations(finalFiltered);
      setResultsCount(finalFiltered.length);

      // Auto-fit once to include all markers, unless user has interacted
      if (withCoords.length > 0 && !hasUserInteracted && !hasAutoFitted) {
        const lats = withCoords.map((loc) => loc.coordinates.lat);
        const lons = withCoords.map((loc) => loc.coordinates.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const latSpan = Math.max(0.01, maxLat - minLat);
        const lonSpan = Math.max(0.01, maxLon - minLon);
        const paddingFactor = 1.4;
        const nextRegion = {
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: latSpan * paddingFactor,
          longitudeDelta: lonSpan * paddingFactor,
        };
        if (
          mapRef.current &&
          typeof mapRef.current.animateToRegion === "function"
        ) {
          mapRef.current.animateToRegion(nextRegion, 600);
        }
        setMapRegion(nextRegion);
        setHasAutoFitted(true);
      }
    } catch (err) {
      console.error("Error fetching locations:", err);
    } finally {
    }
  };

  const goToSearchResult = () => {
    const q = (searchText || "").trim();
    if (!q) return;
    const target =
      Array.isArray(locations) && locations.length > 0 ? locations[0] : null;
    if (!target) return;
    handleLocationPress(target);
  };

  // Initial markers fetch
  useEffect(() => {
    fetchLocations();
  }, []);

  // Refetch markers when filters change
  useEffect(() => {
    fetchLocations();
  }, [
    filterFamilies,
    filterStatuses,
    filterStartDate,
    filterEndDate,
    searchText,
  ]);

  useEffect(() => {
    if (showHeatmap && mapRegion) {
      fetchHeatmapDensity();
    }
  }, [showHeatmap, mapRegion]);

  const renderHeatmapLayer = ({ gradient, radius, opacity, region }) => {
    const filtered = densityPoints.filter((p) => {
      const b = getRegionBounds(region);
      if (!b) return true;
      return (
        p.latitude >= b.minLat &&
        p.latitude <= b.maxLat &&
        p.longitude >= b.minLon &&
        p.longitude <= b.maxLon
      );
    });

    if (!filtered.length || !Heatmap) return null;
    const scale = Platform.select({ ios: 30, android: 10, default: 10 });
    const max = Math.max(1, densityMax || 1);
    const points = filtered.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      weight: Math.max(1, Math.round((p.observation_count / max) * scale)),
    }));
    return (
      <Heatmap
        points={points}
        radius={radius}
        opacity={opacity}
        gradient={gradient}
      />
    );
  };

  // Pull-to-refresh handler: reload markers, family options, and heatmap if active
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchLocations();
      await fetchFamilyOptions();
      if (showHeatmap) {
        await fetchHeatmapDensity();
      }
    } catch (err) {
      console.warn("Refresh error:", err?.message || err);
    } finally {
      setRefreshing(false);
    }
  };

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const computeCardPosition = (pt, dims, layout) => {
    const pad = 12;
    const safeLeft = clamp(
      (pt?.x ?? layout.width / 2) + pad,
      pad,
      Math.max(pad, layout.width - dims.width - pad)
    );
    const safeTop = clamp(
      (pt?.y ?? layout.height / 2) - dims.height - pad,
      pad,
      Math.max(pad, layout.height - dims.height - pad)
    );
    return { left: safeLeft, top: safeTop };
  };

  const showCardAfterCenter = async (loc, mapped) => {
    let pt = null;
    try {
      if (
        mapRef.current &&
        typeof mapRef.current.pointForCoordinate === "function"
      ) {
        pt = await mapRef.current.pointForCoordinate({
          latitude: loc.coordinates.lat,
          longitude: loc.coordinates.lon,
        });
      }
    } catch (e) {
      pt = { x: mapLayout.width / 2, y: mapLayout.height / 2 };
    }
    setLastPinPoint(pt);
    const pos = computeCardPosition(pt, cardDims, mapLayout);
    setCardPosition(pos);
    setSelectedPlant(mapped);
    setShowPlantCard(true);
    setPendingSelection(null);
  };

  const handleLocationPress = (loc) => {
    const mapped = {
      // Align keys with HomeScreen and PlantDetail expectations
      image_url: loc.plant?.image_url || loc.image_url || null,
      common_name: loc.plant?.common_name || "Unknown",
      scientific_name: loc.plant?.scientific_name || "",
      family: loc.plant?.family || "",
      description: loc.plant?.description || "",
      plant_id: loc.plant_id,
      observation_id: loc.observation_id,
      coordinates: loc.coordinates,
    };

    setShowPlantCard(false);
    setSelectedPlant(null);
    setHasUserInteracted(true);
    setPendingSelection({ loc, mapped });

    const nextRegion = {
      latitude: loc.coordinates.lat,
      longitude: loc.coordinates.lon,
      latitudeDelta: mapRegion?.latitudeDelta ?? 0.02,
      longitudeDelta: mapRegion?.longitudeDelta ?? 0.02,
    };
    if (
      mapRef.current &&
      typeof mapRef.current.animateToRegion === "function"
    ) {
      mapRef.current.animateToRegion(nextRegion, 350);
    }
    setMapRegion(nextRegion);
  };

  const closePlantCard = () => {
    setShowPlantCard(false);
    setSelectedPlant(null);
  };

  const handleViewDetails = () => {
    closePlantCard();
    // Use same route name and param structure as HomeScreen
    navigation.navigate("PlantDetail", { plant: selectedPlant, origin: "Map" });
  };

  const toggleStatus = (status) => {
    setFilterStatuses((prev) => {
      if (prev.includes(status)) return prev.filter((s) => s !== status);
      return [...prev, status];
    });
  };

  const clearFilters = () => {
    setFilterFamilies([]);
    setFilterStatuses([]);
    setFilterStartDate("");
    setFilterEndDate("");
    setDatePreset(null);
    setFilterError(null);
  };

  const applyFilters = () => {
    setFilterError(null);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (filterStartDate && !dateRegex.test(filterStartDate)) {
      setFilterError("Start date must be in YYYY-MM-DD format");
      return;
    }
    if (filterEndDate && !dateRegex.test(filterEndDate)) {
      setFilterError("End date must be in YYYY-MM-DD format");
      return;
    }
    if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
      setFilterError("Start date must be before end date");
      return;
    }
    setFilterVisible(false);
  };

  // Quick date range presets
  const applyDatePreset = (preset) => {
    setFilterError(null);
    const today = new Date();
    let start = null;
    let end = null;
    switch (preset) {
      case "today":
        start = today;
        end = today;
        break;
      case "last7": {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        break;
      }
      case "last30": {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 29);
        break;
      }
      case "last90": {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 89);
        break;
      }
      case "thisMonth": {
        end = today;
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      default:
        return;
    }
    setFilterStartDate(formatDateISO(start));
    setFilterEndDate(formatDateISO(end));
    setDatePreset(preset);
  };

  const openFamilyDropdown = () => {
    setTempFilterFamilies(filterFamilies);
    setFamilyDropdownVisible(true);
    AccessibilityInfo.announceForAccessibility?.("Select plant families.");
  };
  const closeFamilyDropdown = () => {
    setFamilyDropdownVisible(false);
  };
  const toggleTempFamily = (fam) => {
    setTempFilterFamilies((prev) => {
      if (prev.includes(fam)) return prev.filter((f) => f !== fam);
      return [...prev, fam];
    });
  };
  const confirmFamilySelection = () => {
    setFilterFamilies(tempFilterFamilies);
    setFamilyDropdownVisible(false);
  };
  const clearAllFamilies = () => {
    setTempFilterFamilies([]);
  };

  const fetchFamilyOptions = async () => {
    try {
      const accessToken = await retrieveAccessToken();
      const res = await fetch(`${API_BASE}/map/locations/public`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Family options fetch failed");
      const data = await res.json();
      const list = Array.isArray(data?.locations) ? data.locations : [];
      const families = Array.from(
        new Set(
          list.map((loc) => (loc?.plant?.family || "").trim()).filter(Boolean)
        )
      ).sort();
      setFamilyOptions(families);
    } catch (err) {
      console.warn("Unable to load family options:", err?.message || err);
      setFamilyOptions((prev) => {
        const families = Array.from(
          new Set(
            locations
              .map((loc) => (loc?.plant?.family || "").trim())
              .filter(Boolean)
          )
        ).sort();
        return families.length ? families : prev;
      });
    }
  };

  useEffect(() => {
    fetchFamilyOptions();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2e7d32"
            colors={["#2e7d32"]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.appTitle}>Plant Map</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFilterVisible(true)}
            >
              <Ionicons name="options-outline" size={18} color="#2e7d32" />
              <Text style={styles.filterText}>Filter</Text>
              <View style={styles.filterResultsBadge}>
                <Ionicons
                  name="leaf-outline"
                  size={14}
                  style={styles.filterResultsIcon}
                />
                <Text style={styles.filterResultsText}>
                  {resultsCount} results
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search the plants"
              value={searchText}
              onChangeText={setSearchText}
            />
            <Ionicons
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            {Boolean(searchText) && locations.length > 0 && (
              <TouchableOpacity
                onPress={goToSearchResult}
                accessibilityRole="button"
                accessibilityLabel="Go to first matching location"
                style={styles.jumpSearchBtn}
              >
                <Ionicons name="navigate-outline" size={20} color="#2e7d32" />
              </TouchableOpacity>
            )}
            {Boolean(searchText) && (
              <TouchableOpacity
                onPress={() => setSearchText("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={styles.clearSearchBtn}
              >
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View
          style={styles.mapContainer}
          onLayout={(e) =>
            setMapLayout({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            onRegionChangeComplete={(r) => {
              setMapRegion(r);
              setHasUserInteracted(true);
              if (showHeatmap) {
                fetchHeatmapDensity();
              }
              if (pendingSelection) {
                const targetLat = pendingSelection.loc.coordinates.lat;
                const targetLon = pendingSelection.loc.coordinates.lon;
                const closeEnough =
                  Math.abs(r.latitude - targetLat) < 0.0005 &&
                  Math.abs(r.longitude - targetLon) < 0.0005;
                if (closeEnough) {
                  showCardAfterCenter(
                    pendingSelection.loc,
                    pendingSelection.mapped
                  );
                }
              }
            }}
            onPanDrag={() => setHasUserInteracted(true)}
            onLongPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setPinCoords({ latitude, longitude });
            }}
          >
            {showHeatmap &&
              densityPoints.length > 0 &&
              renderHeatmapLayer({
                gradient: heatGradient,
                radius: heatRadius,
                opacity: heatOpacity,
                region: mapRegion,
              })}

            {!showHeatmap &&
              locations.map((loc) => (
                <Marker
                  key={`loc-${loc.observation_id}-${loc.plant_id}`}
                  coordinate={{
                    latitude: loc.coordinates.lat,
                    longitude: loc.coordinates.lon,
                  }}
                  onPress={() => handleLocationPress(loc)}
                  accessibilityLabel={`Location for ${
                    loc?.plant?.common_name || "plant"
                  } observation`}
                  pinColor="#ff0000ff"
                />
              ))}

            {!showHeatmap && pinCoords && (
              <Marker
                coordinate={pinCoords}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setPinCoords({ latitude, longitude });
                }}
                accessibilityLabel="Dropped pin"
                pinColor="#3dc2ffff"
              />
            )}
          </MapView>

          {showPlantCard && (
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={closePlantCard}
            />
          )}
          {showPlantCard && selectedPlant && (
            <View
              style={[
                styles.plantCardOverlay,
                {
                  left: cardPosition.left,
                  top: cardPosition.top,
                  width: cardDims.width,
                },
              ]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                // Update dims and re-clamp position to keep within viewport
                if (width !== cardDims.width || height !== cardDims.height) {
                  const nextDims = { width, height };
                  setCardDims(nextDims);
                  const nextPos = computeCardPosition(
                    lastPinPoint,
                    nextDims,
                    mapLayout
                  );
                  setCardPosition(nextPos);
                }
              }}
            >
              <View
                style={[
                  styles.cardPointer,
                  {
                    left: clamp(
                      (lastPinPoint?.x ??
                        cardPosition.left + cardDims.width / 2) -
                        cardPosition.left -
                        8,
                      10,
                      Math.max(10, cardDims.width - 26)
                    ),
                  },
                ]}
              />
              <View style={styles.plantCard}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closePlantCard}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
                {selectedPlant && (
                  <>
                    <View style={styles.cardHeader}>
                      {selectedPlant.image_url || selectedPlant.image ? (
                        <Image
                          source={{
                            uri: resolveImageUrl(selectedPlant.image_url || selectedPlant.image),
                          }}
                          style={styles.cardImage}
                        />
                      ) : (
                        <View style={styles.cardImagePlaceholder}>
                          <Ionicons name="leaf" size={24} color="#2e7d32" />
                        </View>
                      )}
                      <View style={styles.cardText}>
                        <Text style={styles.plantCardName} numberOfLines={1}>
                          {selectedPlant.common_name ||
                            selectedPlant.name ||
                            "Unknown"}
                        </Text>
                        <Text
                          style={styles.plantCardScientific}
                          numberOfLines={2}
                        >
                          {selectedPlant.scientific_name ||
                            selectedPlant.scientificName ||
                            ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.plantCardInfo}>
                      <TouchableOpacity
                        style={styles.viewDetailsButton}
                        onPress={handleViewDetails}
                      >
                        <Text style={styles.viewDetailsText}>View Details</Text>
                        <Text style={styles.arrowIcon}>→</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
          {showHeatmap && (!densityPoints || densityPoints.length === 0) && (
            <View style={styles.legendEmpty}>
              <Text style={styles.legendTitle}>No heatmap data in view</Text>
              <Text style={styles.legendLabel}>
                Try zooming out or changing filters.
              </Text>
            </View>
          )}
          {showHeatmap && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Observation Density</Text>
              <View style={styles.legendBar}>
                {heatGradient.colors.map((c, i) => (
                  <View
                    key={`lg-${i}`}
                    style={[styles.legendSwatch, { backgroundColor: c }]}
                  />
                ))}
              </View>
              <View style={styles.legendLabelsRow}>
                <Text style={styles.legendLabel}>Low</Text>
                <Text style={styles.legendLabel}>High</Text>
              </View>
              <Text style={styles.legendScale}>0 — {densityMax} obs</Text>
            </View>
          )}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={() => {
              setShowHeatmap((v) => {
                const next = !v;
                if (next && mapRegion) {
                  fetchHeatmapDensity();
                }
                return next;
              });
            }}
            style={[
              styles.heatmapToggle,
              showHeatmap && styles.heatmapToggleActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              showHeatmap ? "Hide heatmap overlay" : "Show heatmap overlay"
            }
          >
            <Ionicons
              name="stats-chart"
              size={16}
              style={[
                styles.heatmapToggleIcon,
                showHeatmap && styles.heatmapToggleIconActive,
              ]}
            />
            <Text
              style={[
                styles.heatmapToggleText,
                showHeatmap && styles.heatmapToggleTextActive,
              ]}
            >
              {showHeatmap ? "Heatmap On" : "Heatmap Off"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locationButton, styles.locationButtonInline]}
            onPress={async () => {
              try {
                let perm = await Location.getForegroundPermissionsAsync();
                if (perm.status !== "granted") {
                  const req =
                    await Location.requestForegroundPermissionsAsync();
                  if (req.status !== "granted") return;
                }
                const last = await Location.getLastKnownPositionAsync();
                const accuracy =
                  Platform.OS === "android"
                    ? Location.Accuracy.Balanced
                    : Location.Accuracy.High;
                let loc = null;
                if (last) {
                  const regionA = {
                    latitude: last.coords.latitude,
                    longitude: last.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  };
                  if (
                    mapRef.current &&
                    typeof mapRef.current.animateToRegion === "function"
                  ) {
                    mapRef.current.animateToRegion(regionA, 600);
                  }
                  setMapRegion(regionA);
                  setPinCoords({
                    latitude: regionA.latitude,
                    longitude: regionA.longitude,
                  });
                }
                try {
                  loc = await withTimeout(
                    Location.getCurrentPositionAsync({ accuracy }),
                    6000
                  );
                } catch (e) {}
                const final = loc || last;
                if (!final) return;
                const regionB = {
                  latitude: final.coords.latitude,
                  longitude: final.coords.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                };
                if (
                  mapRef.current &&
                  typeof mapRef.current.animateToRegion === "function"
                ) {
                  mapRef.current.animateToRegion(regionB, 600);
                }
                setMapRegion(regionB);
                setPinCoords({
                  latitude: regionB.latitude,
                  longitude: regionB.longitude,
                });
              } catch (err) {
                console.warn("Failed to recenter:", err?.message || err);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Recenter map to your location"
          >
            <Ionicons name="locate" style={styles.locationIcon} />
          </TouchableOpacity>
        </View>

        <Modal
          visible={filterVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setFilterVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity onPress={() => setFilterVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {filterError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{filterError}</Text>
                  </View>
                )}
                <View style={styles.dataContainer}>
                  <Text style={styles.inputLabel}>Plant Family</Text>
                  <TouchableOpacity
                    style={styles.textInput}
                    onPress={openFamilyDropdown}
                    accessibilityRole="button"
                    accessibilityLabel="Open plant family selector"
                  >
                    <Text>
                      {filterFamilies.length
                        ? `${filterFamilies.length} selected`
                        : "Select plant families"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Modal
                  visible={familyDropdownVisible}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={closeFamilyDropdown}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                          Select Plant Families
                        </Text>
                        <TouchableOpacity onPress={closeFamilyDropdown}>
                          <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                      </View>

                      <ScrollView style={styles.modalBody}>
                        <View style={styles.dataContainer}>
                          {familyOptions.length === 0 ? (
                            <Text>No family options available.</Text>
                          ) : (
                            familyOptions.map((fam) => {
                              const selected = tempFilterFamilies.includes(fam);
                              return (
                                <TouchableOpacity
                                  key={`fam-opt-${fam}`}
                                  onPress={() => toggleTempFamily(fam)}
                                  style={[
                                    styles.statusChip,
                                    selected ? styles.statusChipActive : null,
                                  ]}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: selected }}
                                  accessibilityLabel={fam}
                                >
                                  <Text
                                    style={[
                                      styles.statusChipText,
                                      selected
                                        ? styles.statusChipTextActive
                                        : null,
                                    ]}
                                  >
                                    {fam}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      </ScrollView>

                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={clearAllFamilies}
                          accessibilityRole="button"
                          accessibilityLabel="Clear all selected families"
                        >
                          <Text style={styles.cancelButtonText}>
                            Clear Selection
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={confirmFamilySelection}
                          accessibilityRole="button"
                          accessibilityLabel="Apply selected families"
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Status:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterOptions}
                    contentContainerStyle={styles.filterOptionsContent}
                  >
                    {ALL_STATUSES.map((s) => {
                      const label = s
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      const active = filterStatuses.includes(s);
                      return (
                        <TouchableOpacity
                          key={`status-${s}`}
                          style={[
                            styles.filterOption,
                            active && styles.filterOptionActive,
                          ]}
                          onPress={() => toggleStatus(s)}
                        >
                          <Text
                            style={[
                              styles.filterOptionText,
                              active && styles.filterOptionTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Date Range:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterOptions}
                    contentContainerStyle={styles.filterOptionsContent}
                  >
                    {[
                      { key: "today", label: "Today" },
                      { key: "last7", label: "Last 7 days" },
                      { key: "last30", label: "Last 30 days" },
                      { key: "last90", label: "Last 90 days" },
                      { key: "thisMonth", label: "This month" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={`date-${opt.key}`}
                        onPress={() => applyDatePreset(opt.key)}
                        style={[
                          styles.filterOption,
                          datePreset === opt.key && styles.filterOptionActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${opt.label}`}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            datePreset === opt.key &&
                              styles.filterOptionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.cancelButtonText}>Clear Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={applyFilters}
                >
                  <Text style={styles.saveButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

// Device-based modal sizing to prevent overflow on small screens
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_MAX_HEIGHT = Math.floor(SCREEN_HEIGHT * 0.85);
const MODAL_BODY_MAX_HEIGHT = Math.floor(SCREEN_HEIGHT * 0.7);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    position: "relative",
  },
  searchInput: {
    backgroundColor: "#f1f3f4",
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: 12,
  },
  clearSearchBtn: {
    position: "absolute",
    right: 12,
    top: 10,
    padding: 2,
  },
  jumpSearchBtn: {
    position: "absolute",
    right: 40,
    top: 10,
    padding: 2,
  },
  titleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    marginTop: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2e7d32",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  filterText: {
    fontSize: 14,
    color: "#2e7d32",
    fontWeight: "600",
    marginLeft: 6,
  },
  filterResultsBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  filterResultsText: {
    color: "#2e7d32",
    fontSize: 12,
    fontWeight: "600",
  },
  filterResultsIcon: {
    color: "#2e7d32",
    marginRight: 4,
  },

  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#c8e6c9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerIcon: {
    fontSize: 18,
    color: "#2e7d32",
  },
  markerUser: {
    backgroundColor: "#e3f2fd",
    borderColor: "#90caf9",
  },
  markerIconUser: {
    color: "#1565c0",
  },
  heatmapToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderColor: "#c8e6c9",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heatmapToggleActive: {
    backgroundColor: "#2e7d32",
    borderColor: "#1b5e20",
  },
  heatmapToggleIcon: {
    color: "#2e7d32",
    marginRight: 6,
  },
  heatmapToggleIconActive: {
    color: "#ffffff",
  },
  heatmapToggleText: {
    color: "#2e7d32",
    fontWeight: "600",
  },
  heatmapToggleTextActive: {
    color: "#ffffff",
  },

  mapContainer: {
    flex: 1,
    backgroundColor: "#e9ecef",
    margin: 20,
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  legend: {
    position: "absolute",
    right: 16,
    top: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    maxWidth: 180,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  legendBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 4,
  },
  legendSwatch: {
    flex: 1,
  },
  legendLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendLabel: {
    fontSize: 10,
    color: "#555",
  },
  legendScale: {
    marginTop: 4,
    fontSize: 10,
    color: "#555",
  },
  legendEmpty: {
    position: "absolute",
    left: 16,
    top: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    maxWidth: 220,
  },
  plantCardOverlay: {
    position: "absolute",
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cardPointer: {
    position: "absolute",
    bottom: -8,
    width: 16,
    height: 16,
    backgroundColor: "#ffffff",
    borderColor: "#ddd",
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 640,
    maxHeight: MODAL_MAX_HEIGHT,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalBody: {
    padding: 20,
    maxHeight: MODAL_BODY_MAX_HEIGHT,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },

  errorContainer: {
    backgroundColor: "#fdecea",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: "#b00020",
    fontSize: 14,
  },
  dataContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f1f3f4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },

  statusChip: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: {
    backgroundColor: "#e8f5e8",
    borderColor: "#2e7d32",
  },
  statusChipText: {
    fontSize: 14,
    color: "#666",
  },
  statusChipTextActive: {
    color: "#2e7d32",
    fontWeight: "600",
  },

  filterGroup: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  filterOptions: {
    // keep default ScrollView styling
  },
  filterOptionsContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterOption: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionActive: {
    backgroundColor: "#e8f5e8",
    borderColor: "#2e7d32",
  },
  filterOptionText: {
    fontSize: 14,
    color: "#666",
  },
  filterOptionTextActive: {
    color: "#2e7d32",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  applyBtn: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },

  locationButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#c8e6c9",
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  locationButtonInline: {
    position: "relative",
    right: undefined,
    bottom: undefined,
  },
  locationIcon: {
    fontSize: 22,
    color: "#2e7d32",
  },
  plantCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    minWidth: 220,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: "#666",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f1f3f4",
  },
  cardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f1f3f4",
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    flex: 1,
  },
  plantCardInfo: {
    paddingHorizontal: 2,
  },
  plantCardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  plantCardScientific: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 8,
  },
  viewDetailsButton: {
    backgroundColor: "#2e7d32",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  viewDetailsText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  arrowIcon: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default MapScreen;
