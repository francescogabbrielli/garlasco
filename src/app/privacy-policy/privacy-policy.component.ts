import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-privacy-policy',
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
})
export class PrivacyPolicyComponent implements OnInit {

  owner = signal('')
  email = signal('')
  title = signal('')

  async ngOnInit() {
    import('../../../package.json').then(p => {
      this.owner.set(p.author.name)
      this.email.set(p.author.email)
      this.title.set(p.name)
    })
  }

}
