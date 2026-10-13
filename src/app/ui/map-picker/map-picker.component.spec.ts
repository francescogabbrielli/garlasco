import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapPickerComponent } from './map-picker.component';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

describe('MapPickerComponent', () => {
  let component: MapPickerComponent;
  let fixture: ComponentFixture<MapPickerComponent>;
  let load: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Never resolves, so the real google-map element is not rendered
    load = vi.fn(() => new Promise<void>(() => undefined));

    await TestBed.configureTestingModule({
      imports: [MapPickerComponent],
      providers: [{ provide: GoogleMapsLoaderService, useValue: { load } }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and ask the loader for Google Maps', () => {
    expect(component).toBeTruthy();
    expect(load).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Caricamento mappa');
  });

  it('should show an error when Google Maps cannot be loaded', async () => {
    load.mockRejectedValue(new Error('no key'));
    const failing = TestBed.createComponent(MapPickerComponent);
    await failing.componentInstance.ngOnInit();
    failing.detectChanges();

    expect(failing.componentInstance.mapError()).toBeTruthy();
    expect(failing.nativeElement.textContent).toContain('Impossibile caricare Google Maps');
  });

  it('should emit an exact position (radius 0) for a clicked point', () => {
    const picked = vi.fn();
    component.picked.subscribe(picked);

    component.onMapClick({ latLng: { toJSON: () => ({ lat: 45.1, lng: 9.2 }) } } as google.maps.MapMouseEvent);
    component.confirm();

    expect(picked).toHaveBeenCalledWith({ latitude: 45.1, longitude: 9.2, radius: 0 });
  });

  it('should forget the clicked point when the selection is cleared', () => {
    component.onMapClick({ latLng: { toJSON: () => ({ lat: 1, lng: 2 }) } } as google.maps.MapMouseEvent);
    component.clearSelection();

    expect(component.selectedPoint()).toBeNull();
  });

  it('should not emit anything when confirming without a point or a map', () => {
    const picked = vi.fn();
    component.picked.subscribe(picked);

    component.confirm();

    expect(picked).not.toHaveBeenCalled();
  });

  it('should emit closed', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.close();

    expect(closed).toHaveBeenCalled();
  });
});
