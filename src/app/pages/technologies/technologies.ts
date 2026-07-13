import { Component } from '@angular/core';
import { InfoHeader } from '../../components/info-header/info-header';

@Component({
  selector: 'app-technologies',
  standalone: true,
  imports: [InfoHeader],
  templateUrl: './technologies.html',
  styleUrl: './technologies.css'
})
export class Technologies {
}