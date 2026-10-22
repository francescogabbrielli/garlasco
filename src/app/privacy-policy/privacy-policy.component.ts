import { Component, inject, OnInit, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-privacy-policy',
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
})
export class PrivacyPolicyComponent implements OnInit {

  titleService = inject(Title)

  owner = signal('')
  email = signal('')
  title = signal('')

  async ngOnInit() {
    import('../../../package.json').then(p => {
      this.owner.set(p.author.name)
      this.email.set(p.author.email)
      this.title.set(p.displayName)
      this.titleService.setTitle(p.displayName + ' - Informativa sulla Privacy')
    })
  }

}
