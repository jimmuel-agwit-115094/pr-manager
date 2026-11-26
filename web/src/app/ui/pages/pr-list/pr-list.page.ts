import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrentUserStore } from '../../../services/current-user.store';
import { PrListStore } from '../../../services/pr-list.store';
import { PrFilterTabsComponent } from '../../components/pr-filter-tabs/pr-filter-tabs.component';
import { PrListItemComponent } from '../../components/pr-list-item/pr-list-item.component';
import { RepoPickerComponent } from '../../components/repo-picker/repo-picker.component';

@Component({
  selector: 'app-pr-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RepoPickerComponent, PrFilterTabsComponent, PrListItemComponent],
  templateUrl: './pr-list.page.html',
  styleUrl: './pr-list.page.scss',
})
export class PrListPage {
  protected readonly store = inject(PrListStore);
  protected readonly currentUser = inject(CurrentUserStore);
  protected readonly skeletonRows = [1, 2, 3, 4];
}
