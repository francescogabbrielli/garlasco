import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactFormComponent } from './contact-form.component';
import { vi } from 'vitest';
import { UserProfileService } from '../../user-profile.service';
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';

describe('ContactFormComponent', () => {
  let component: ContactFormComponent
  let fixture: ComponentFixture<ContactFormComponent>

    const mockUserData = {
    getId: () => '123',
    getEmail: () => 'utente@test.com',
    isAdmin: () => false,
  }

  const mockUserService = {
      sendAdminEmail: vi.fn(),
      user: () => mockUserData
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent],
      providers: [
        // Sostituiamo il servizio reale con il mock
        { provide: UserProfileService, useValue: mockUserService },
      ],
    }).compileComponents()

    fixture = TestBed.createComponent(ContactFormComponent)
    component = fixture.componentInstance
    
    // Ripuliamo lo stato del mock prima di ogni test
    vi.clearAllMocks()
  })

  it('should create the component', () => {
    expect(component).toBeTruthy()
  })

  it('should not submit if the user signal is not set', async () => {
    await component.submitEvent()
    expect(mockUserService.sendAdminEmail).not.toHaveBeenCalled()
  })

  it('should show an error if the form is incomplete on submit', async () => {
    fixture.componentRef.setInput('user', mockUserData)
    
    await component.submitEvent()

    expect(component.sendError()).toBe('Completa tutti i campi obbligatori prima di inviare il form.')
    expect(mockUserService.sendAdminEmail).not.toHaveBeenCalled()
  })

  it('should successfully submit when the form is valid', async () => {
    fixture.componentRef.setInput('user', mockUserData)
    fixture.detectChanges()
    const splash = fixture.debugElement.query(By.directive(SplashDialogComponent)).componentInstance as SplashDialogComponent;
    const showSplash = vi.spyOn(splash, 'show').mockResolvedValue()
    
    component.contactForm.setValue({
      reason: 'Richiesta informazioni',
      message: 'Questo è un messaggio di test.',
    })

    mockUserService.sendAdminEmail.mockResolvedValue({
      data: { success: true },
      errors: null,
    })

    const sentEmitSpy = vi.spyOn(component.sent, 'emit')
    const closeEmitSpy = vi.spyOn(component.close, 'emit')

    await component.submitEvent()

    expect(mockUserService.sendAdminEmail).toHaveBeenCalledWith('Richiesta informazioni', 'Questo è un messaggio di test.')
    expect(sentEmitSpy).toHaveBeenCalledOnce()
    expect(closeEmitSpy).not.toHaveBeenCalled()
    expect(component.sendError()).toBe('')
    expect(component.isSending()).toBe(false)
    expect(showSplash).toHaveBeenCalledOnce()
  })

  it('should handle errors returned in the GraphQL errors array correctly', async () => {
    fixture.componentRef.setInput('user', mockUserData);
    component.contactForm.setValue({
      reason: 'Segnalazione problema',
      message: 'Errore atteso',
    });

    mockUserService.sendAdminEmail.mockResolvedValue({
      data: null,
      errors: [{ message: 'Impossibile inviare l`email: utente non autorizzato' }],
    });

    await component.submitEvent();

    expect(component.sendError()).toBe('Errore server durante l’invio del form [Impossibile inviare l`email: utente non autorizzato]');
    expect(component.isSending()).toBe(false);
  });

  it('should catch network or system exceptions (catch block)', async () => {
    fixture.componentRef.setInput('user', mockUserData);
    component.contactForm.setValue({
      reason: 'Altro',
      message: 'Test crash di rete',
    });

    mockUserService.sendAdminEmail.mockRejectedValue(new Error('Network Error - Connessione assente'));

    await component.submitEvent();

    expect(component.sendError()).toBe('Errore server durante l’invio del form [Network Error - Connessione assente]');
    expect(component.isSending()).toBe(false);
  });
});