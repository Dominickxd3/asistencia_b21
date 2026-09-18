import { TuiRoot } from '@taiga-ui/core';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, TuiRoot],
  selector: 'app-root',
  template: '<tui-root><router-outlet /></tui-root>',
})
export class App {}
