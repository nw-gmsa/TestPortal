import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {Router} from "@angular/router";
import {DocumentReference} from 'fhir/r4';
import {FhirService} from '../../../services/fhir.service';
import {ResourceDialogComponent} from '../../../dialogs/resource-dialog/resource-dialog.component';
import {MatSort} from '@angular/material/sort';
import {DeleteComponent} from "../../../dialogs/delete/delete.component";
import {MatDialog, MatDialogConfig, MatDialogRef} from "@angular/material/dialog";
import {MatTableDataSource} from "@angular/material/table";
import {environment} from "../../../../environments/environment";
import {MatPaginator} from "@angular/material/paginator";

@Component({
  selector: 'app-document-reference',
  templateUrl: './document-reference.component.html',
  styleUrls: ['./document-reference.component.css']
})
export class DocumentReferenceComponent implements OnInit {

  @Input() documents: DocumentReference[] | undefined;

  @Input() documentsTotal: number | undefined;

  @Input() patientId: string | undefined;

  @Output() documentReference = new EventEmitter<any>();



  // @ts-ignore
  dataSource: MatTableDataSource<DocumentReference>;

  @ViewChild(MatSort) sort: MatSort | undefined;

    @ViewChild(MatPaginator) paginator: MatPaginator | undefined;

  displayedColumns = [ 'created','category', 'type', 'setting', 'author', 'custodian',  'status', 'resource'];

  constructor(private router: Router,
              private _viewContainerRef: ViewContainerRef,
              public fhirService: FhirService,
              public dialog: MatDialog) { }

  ngOnInit() {
    if (this.patientId !== undefined) {
      //this.dataSource = new DocumentReferenceDataSource(this.fhirService, this.patientId, []);
    } else {
      this.dataSource = new MatTableDataSource<DocumentReference>(this.documents);
    }
  }

  ngAfterViewInit() {
    if (this.sort != undefined) {
      this.sort.sortChange.subscribe((event) => {
        console.log(event);
      });
      // @ts-ignore
      this.dataSource.sort = this.sort;
    } else {
      console.log('SORT UNDEFINED');
    }
    // @ts-ignore
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'created': {
          if (item.date !== undefined) {

            return item.date
          }
          return undefined;
        }
        default: {
          return undefined
        }
      };
    };

    if (this.dataSource !== undefined && this.paginator !== undefined) this.dataSource.paginator = this.paginator;
  }

  ngOnChanges(changes: SimpleChanges) {

    if (changes['documents'] !== undefined) {
      // console.log(this.tasks);
      this.dataSource = new MatTableDataSource<DocumentReference>(this.documents);
    } else {
      //  console.log(changes)
    }
  }

  selectDocument(document: DocumentReference) {
    console.log(document)
      this.router.navigate(['/patient', document.subject?.reference?.replace('Patient/',''), 'documents', document.id])
  }


  getMime(mimeType: string) {

    switch (mimeType) {
        case 'application/fhir+xml':
        case 'application/fhir+json':
          return 'FHIR Document';

        case 'application/pdf':
          return 'PDF';
        case 'image/jpeg':
          return 'Image';
    }
    return mimeType;
  }

  select(resource: any) {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {
      id: 1,
      resource: resource
    };
    const resourceDialog: MatDialogRef<ResourceDialogComponent> = this.dialog.open( ResourceDialogComponent, dialogConfig);
  }

  delete(documentReference: DocumentReference) {
    let dialogRef = this.dialog.open(DeleteComponent, {
      width: '250px',
      data:  documentReference
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {

        this.fhirService.deleteTIE('/DocumentReference/'+documentReference.id).subscribe(result => {

          if (this.documents !== undefined) {
            this.documents.forEach((taskIt, index) => {
              if (taskIt.id === documentReference.id) {
                // @ts-ignore
                this.documents.splice(index, 1);
              }
            })
            this.dataSource = new MatTableDataSource<DocumentReference>(this.documents);
          }
        })
      }
    });
  }

    protected readonly environment = environment;
}
