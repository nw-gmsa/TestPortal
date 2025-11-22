import {Component, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {FhirService} from "../../services/fhir.service";
import {EprService} from "../../services/epr.service";
import {IAlertConfig, TdDialogService} from "@covalent/core/dialogs";
import {DocumentReference, Patient} from "fhir/r4";
import {BinaryComponent} from "./binary/binary.component";
import {MatDialog, MatDialogConfig, MatDialogRef} from "@angular/material/dialog";
import {DocumentReferenceCreateComponent} from "./document-reference-create/document-reference-create.component";
import {environment} from "../../../environments/environment";
import {MatPaginator} from "@angular/material/paginator";
import {MatSort} from "@angular/material/sort";

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DocumentsComponent implements OnInit {
  documents: DocumentReference[] = [];
  patientId: string | null = null;
  private nhsNumber: string | undefined;




  constructor( public fhirService: FhirService,
               private eprService: EprService,
               private dialogService: TdDialogService,
               public dialog: MatDialog,
               private viewContainerRef: ViewContainerRef) { }

  ngOnInit(): void {
    let patient = this.eprService.getPatient()
    if (patient !== undefined) {
      if (patient.id !== undefined) {
        this.patientId = patient.id
        this.getRecords(patient);
      }

    }
    this.eprService.patientChangeEvent.subscribe(patient => {
      if (patient.id !== undefined) this.patientId = patient.id

      this.getRecords(patient);
    });
  }


  private getRecords(patient : Patient) {
    if (patient !== undefined ) {
      if (patient.identifier !== undefined){
        for (const identifier of patient.identifier) {
          if (identifier.system !== undefined && identifier.system.includes('nhs-number')) {
            this.nhsNumber = identifier.value;
          }
        }
      }
    }
    this.fhirService.get('/DocumentReference?patient=' + this.patientId + '&_count=50&_sort=-date').subscribe(bundle => {
          if (bundle.entry !== undefined) {
            for (const entry of bundle.entry) {
              if (entry.resource !== undefined && entry.resource.resourceType === 'DocumentReference') { this.documents.push(entry.resource as DocumentReference); }
            }
          }
        }
    );
  }
  selectDocument(document: DocumentReference): void {
    console.log(document);

    if (document.content !== undefined && document.content.length > 0 && document.content[0].attachment !== undefined
        && document.content[0].attachment.url !== undefined) {

      this.fhirService.getBinary(environment.fhirServer + document.content[0].attachment.url).subscribe(result => {

        const dialogConfig = new MatDialogConfig();

        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = {
          id: 1,
          binary: result,
          documentReference: document
        };
        this.dialog.open( BinaryComponent, dialogConfig);
      }, error => {
        if (document.content[0].attachment.contentType !== undefined && document.content[0].attachment.contentType.indexOf('image') === 0) {
          // throw alert if not image
          const alertConfig: IAlertConfig = {message: 'Unable to locate document2.'};
          alertConfig.disableClose = false; // defaults to false
          alertConfig.viewContainerRef = this.viewContainerRef;
          alertConfig.title = 'Alert';
          alertConfig.closeButton = 'Close';
          alertConfig.width = '400px';
          this.dialogService.openAlert(alertConfig);
        } else {
          // Try it anyway
          const dialogConfig = new MatDialogConfig();

          dialogConfig.disableClose = true;
          dialogConfig.autoFocus = true;
          dialogConfig.data = {
            id: 1,
            documentReference: document
          };
          this.dialog.open( BinaryComponent, dialogConfig);
        }
      });

      //  this.router.navigate(['..', 'document', document.id], {relativeTo: this.route });

    } else {
      const alertConfig: IAlertConfig = { message : 'Unable to locate document1.'};
      alertConfig.disableClose =  false; // defaults to false
      alertConfig.viewContainerRef = this.viewContainerRef;
      alertConfig.title = 'Alert';
      alertConfig.closeButton = 'Close';
      alertConfig.width = '400px';
      this.dialogService.openAlert(alertConfig);
    }
  }
  addDocumentMetadata(): void {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.height = '80%';
    dialogConfig.width = '50%';

    dialogConfig.data = {
      id: 1,
      patientId: this.patientId,
      nhsNumber: this.nhsNumber
    };
    const dialogRef = this.dialog.open( DocumentReferenceCreateComponent, dialogConfig);
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined && result.resourceType !== undefined) {
        this.documents.push(result)
        this.documents = Object.assign([], this.documents)
      }
    })
  }

    protected readonly environment = environment;
}
