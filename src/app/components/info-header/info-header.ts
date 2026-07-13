import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-info-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './info-header.html',
  styleUrl: './info-header.css'
})
export class InfoHeader {
}