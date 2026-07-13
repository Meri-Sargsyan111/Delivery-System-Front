import { Component, OnDestroy, OnInit, HostListener, ViewChild, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import {
  CourierLocation,
  LocationWebSocketService
} from '../../services/location-websocket.service';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

const ARMENIA_CENTER: google.maps.LatLngLiteral = { lat: 40.1772, lng: 44.5035 };
const MARKER_ANIMATION_DURATION_MS = 800;
const MOBILE_BREAKPOINT_PX = 900;

const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2330' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2330' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a93a8' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a4257' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a3145' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d2330' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4257' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#232939' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#131722' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#232939' }] }
];

@Component({
  selector: 'app-live-tracking',
  standalone: true,
  imports: [GoogleMap, MapMarker, TranslatePipe],
  templateUrl: './live-tracking.html',
  styleUrl: './live-tracking.css'
})
export class LiveTracking implements OnInit, OnDestroy {

  @ViewChild(GoogleMap) private googleMap?: GoogleMap;

  mapsReady = signal(false);
  center = signal<google.maps.LatLngLiteral>(ARMENIA_CENTER);
  markerPosition = signal<google.maps.LatLngLiteral>(ARMENIA_CENTER);
  mapHeight = signal(this.computeMapHeight());

  readonly zoom = 14;

  readonly mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    styles: DARK_MAP_STYLE
  };

  readonly markerOptions: google.maps.MarkerOptions = {
    title: 'Courier'
  };

  currentOrderId: number | null = null;
  currentLat: number | null = null;
  currentLng: number | null = null;
  isConnected = false;
  lastUpdate: Date | null = null;

  private animationFrameId: number | null = null;

  constructor(
    private locationWebSocketService: LocationWebSocketService,
    private googleMapsLoader: GoogleMapsLoaderService
  ) {}

  ngOnInit(): void {
    this.googleMapsLoader.load().then(() => {

      this.mapsReady.set(true);

      this.locationWebSocketService.connect((location: CourierLocation) => {
        this.handleLocation(location);
      });

    }).catch(err => console.error('Failed to load Google Maps:', err));
  }

  @HostListener('window:resize')
  onResize(): void {
    this.mapHeight.set(this.computeMapHeight());
  }

  private computeMapHeight(): string {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT_PX ? '420px' : '600px';
  }

  private handleLocation(location: CourierLocation): void {

    const target: google.maps.LatLngLiteral = { lat: location.latitude, lng: location.longitude };

    this.animateMarkerTo(target);
    this.googleMap?.panTo(target);

    this.currentOrderId = location.orderId;
    this.currentLat = location.latitude;
    this.currentLng = location.longitude;
    this.isConnected = true;
    this.lastUpdate = new Date();
  }

  private animateMarkerTo(target: google.maps.LatLngLiteral): void {

    const start = this.markerPosition();
    const startTime = performance.now();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const step = (now: number) => {

      const progress = Math.min((now - startTime) / MARKER_ANIMATION_DURATION_MS, 1);

      this.markerPosition.set({
        lat: start.lat + (target.lat - start.lat) * progress,
        lng: start.lng + (target.lng - start.lng) * progress
      });

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {

    this.locationWebSocketService.disconnect();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

}