import { Component } from '@angular/core';
import { InfoHeader } from '../../components/info-header/info-header';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [InfoHeader],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css'
})
export class HowItWorks {
}