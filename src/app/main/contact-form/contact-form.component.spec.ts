import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactFormComponent } from './contact-form.component';
import { vi } from 'vitest';
import { UserProfileService } from '../../user-profile.service';

describe('ContactFormComponent', () => {
  let component: ContactFormComponent
  let fixture: ComponentFixture<ContactFormComponent>

  vi.mock('aws-amplify/data', () => ({
    generateClient: () => ({
      queries: {
        sendEmail: vi.fn().mockResolvedValue({ data: { success: true }, errors: null }),
      },
    }),
  }))

  const mockUserData = {
    getId: () => '123',
    getEmail: () => 'utente@test.com',
  }

  const mockUserService = {
      sendEmail: vi.fn(),
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
    expect(mockUserService.sendEmail).not.toHaveBeenCalled()
  })

  it('should show an error if the form is incomplete on submit', async () => {
    fixture.componentRef.setInput('user', mockUserData)
    
    await component.submitEvent()

    expect(component.sendError()).toBe('Completa tutti i campi obbligatori prima di inviare il form.')
    expect(mockUserService.sendEmail).not.toHaveBeenCalled()
  })

  it('should successfully submit when the form is valid', async () => {
    fixture.componentRef.setInput('user', mockUserData)
    
    component.contactForm.setValue({
      reason: 'Richiesta informazioni',
      message: 'Questo è un messaggio di test.',
    })

    mockUserService.sendEmail.mockResolvedValue({
      data: { success: true },
      errors: null,
    })

    const sentEmitSpy = vi.spyOn(component.sent, 'emit')

    await component.submitEvent()

    expect(mockUserService.sendEmail).toHaveBeenCalledWith('Richiesta informazioni', 'Questo è un messaggio di test.')
    expect(sentEmitSpy).toHaveBeenCalled()
    expect(component.sendError()).toBe('')
    expect(component.isSending()).toBe(false)
  })

  it('should handle errors returned in the GraphQL errors array correctly', async () => {
    fixture.componentRef.setInput('user', mockUserData);
    component.contactForm.setValue({
      reason: 'Segnalazione problema',
      message: 'Errore atteso',
    });

    mockUserService.sendEmail.mockResolvedValue({
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

    mockUserService.sendEmail.mockRejectedValue(new Error('Network Error - Connessione assente'));

    await component.submitEvent();

    expect(component.sendError()).toBe('Errore server durante l’invio del form [Network Error - Connessione assente]');
    expect(component.isSending()).toBe(false);
  });
});