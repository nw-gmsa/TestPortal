import {Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {
    AllergyIntolerance, Condition,
    Encounter,
    Patient, Reference, MedicationRequest, DiagnosticReport, Immunization, Procedure, ServiceRequest,
} from 'fhir/r4';
import {FhirService} from '../../services/fhir.service';
import {EprService} from '../../services/epr.service';
import { TdDialogService} from '@covalent/core/dialogs';
import {StravaService} from '../../services/strava.service';
import {Athlete} from '../../services/models/athlete';
import {LoadingMode, LoadingStrategy, LoadingType, TdLoadingService} from '@covalent/core/loading';
import {WithingsService} from '../../services/withings.service';
import {delay} from 'rxjs/operators';
import {
    MedicationRequestCreateEditComponent
} from "../medications/medication-request-create-edit/medication-request-create-edit.component";
import {MAT_DIALOG_DATA, MatDialog, MatDialogConfig, MatDialogRef} from "@angular/material/dialog";
import {environment} from "../../../environments/environment";
import {MatChip} from "@angular/material/chips";


@Component({
  selector: 'app-patient-summary',
  templateUrl: './patient-summary.component.html',
  styleUrls: ['./patient-summary.component.scss']
})
export class PatientSummaryComponent implements OnInit {

    encounters: Encounter[] = [];

    patient: Patient | undefined;
    patientId: string | null = null;

    // @ts-ignore
  allergies: AllergyIntolerance[] = [];
    // @ts-ignore
  medicationRequests: MedicationRequest[] = [];
    // @ts-ignore
  conditions: Condition[] = [];
  results: DiagnosticReport[] = [];
    requests: ServiceRequest[] = [];
    immunisations: Immunization[] = [];
    procedures: Procedure[] = [];

    loadingMode = LoadingMode;
    loadingStrategy = LoadingStrategy;
    loadingType = LoadingType;


    athlete: Athlete | undefined;

  stravaConnect = true;
  stravaComplete = false;


    @ViewChild('gpchip', {static: false}) gpchip: MatChip | undefined;
  private withingsConnect: boolean | undefined;

  public nhsNumber: string | undefined;
    basicFlavoredMarkdown = `
   Layout is based around [International Patient Summary](https://build.fhir.org/ig/HL7/fhir-ips/ipsStructure.html) and uses a Query API [IHE QEDm](https://wiki.ihe.net/index.php/Query_for_Existing_Data_for_Mobile_(QEDm)) to retrieve the record. 
  
 `;

    // TODO  Potentially add code to automatically generate the [FHIR Document](https://build.fhir.org/ig/HL7/fhir-ips/StructureDefinition-Composition-uv-ips.html) which is the IPS (PRSB + Transfer of Care)  format.
    //

  constructor(private router: Router,
              private fhirService: FhirService,
              private route: ActivatedRoute,
              private eprService: EprService,
              private strava: StravaService,
              private withings: WithingsService,
              private dialogService: TdDialogService,
              public dialog: MatDialog,
              private _loadingService: TdLoadingService) { }

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
      this.route.queryParams.subscribe(params => {
        const code = params['code'];
        const state = params['state'];
        if (code !== undefined) {
          if (state !== undefined && state === 'withings') {
           // console.log('Withings detected');
            this.doWithingsSetup(code, state);
          } else {
            this.doStravaSetup(code);
          }
        }
      });
      this.clearDown();
      this.strava.tokenChange.subscribe(token => {
      //  console.log('Strava Token Received');
        if (token !== undefined) { this.stravaConnect = false; }
        this.stravaLoad();
      });
      this.withings.tokenChange.subscribe(
      token => {
      //  console.log('Withings Token Received');
        if (token !== undefined) { this.withingsConnect = false; }
        this.withingsLoad();
      }
    );
      this.strava.loaded.subscribe(activities => {
    //    console.log('Strava Loaded Received');
    //    console.log(activities)
        const patientRef: Reference = {
          reference: 'Patient/' + this.patientId
        };
        const transaction = this.strava.createTransaction(activities, patientRef);
        this.fhirService.sendTransaction(transaction, 'Strava');
      });
      this.withings.activityLoaded.subscribe(result => {
   //     console.log('Withings Activity Loaded Received');
        const patientRef: Reference = {
          reference: 'Patient/' + this.patientId
        };
        const transaction = this.withings.createTransaction(result, patientRef);
        // console.log(JSON.stringify(transaction))
        this.fhirService.sendTransaction(transaction, 'Withings Activity');
      });
      this.withings.sleepLoaded.subscribe(result => {
     //   console.log('Withings Sleep Loaded Received');
        const patientRef: Reference = {
          reference: 'Patient/' + this.patientId
        };
        const transaction = this.withings.createTransaction(result, patientRef);
       // console.log(JSON.stringify(transaction))
        this.fhirService.sendTransaction(transaction, 'Withings Sleep');
      });
      this.withings.measuresLoaded.subscribe(result => {
      //  console.log('Withings Measures Loaded Received');
        const patientRef: Reference = {
          reference: 'Patient/' + this.patientId
        };
        const transaction = this.withings.createTransaction(result, patientRef);
       // console.log(JSON.stringify(transaction))
        this.fhirService.sendTransaction(transaction, 'Withings Measures');
      });
      // removed &_revinclude=CarePlan:patient

  }

  getRecords(patient : Patient){
      if (patient !== undefined) {
          if (patient.identifier !== undefined) {
              for (const identifier of patient.identifier) {
                  if (identifier.system !== undefined && identifier.system.includes('nhs-number')) {
                      this.nhsNumber = identifier.value;
                  }
              }
          }
      }
      this._loadingService.register('overlayStarSyntax');
      this.conditions = [];
      this.fhirService.get('/Condition?patient=' + this.patientId).subscribe(bundle => {
          this._loadingService.resolve('overlayStarSyntax');
            if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                if (entry.resource !== undefined && entry.resource.resourceType === 'Condition') { this.conditions.push(entry.resource as Condition); }
              }
            }
          }
      );
      /*
      this.allergies = [];
      this.fhirService.get('/AllergyIntolerance?patient=' + this.patientId).subscribe(bundle => {
          this._loadingService.resolve('overlayStarSyntax');
            if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                if (entry.resource !== undefined && entry.resource.resourceType === 'AllergyIntolerance') { this.allergies.push(entry.resource as AllergyIntolerance); }
              }
            }
          }
      );*/
      /*
      this.medicationRequests = [];
      this.fhirService.get('/MedicationRequest?patient=' + this.patientId).subscribe(bundle => {
          this._loadingService.resolve('overlayStarSyntax');
            if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                if (entry.resource !== undefined && entry.resource.resourceType === 'MedicationRequest') { this.medicationRequests.push(entry.resource as MedicationRequest); }
              }
            }
          }
      );

       */
      this.encounters = [];
      this.fhirService.get('/Encounter?patient=' + this.patientId + '&_count=5&_sort=-date').subscribe(bundle => {
          this._loadingService.resolve('overlayStarSyntax');
            if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                if (entry.resource !== undefined && entry.resource.resourceType === 'Encounter') { this.encounters.push(entry.resource as Encounter); }
              }
            }
          }
      );
      this.results = [];
      this.fhirService.get('/DiagnosticReport?patient=' + this.patientId + '&_count=5&_sort=-date').subscribe(bundle => {
              if (bundle.entry !== undefined) {
                  for (const entry of bundle.entry) {
                      if (entry.resource !== undefined && entry.resource.resourceType === 'DiagnosticReport') {
                          this.results.push(entry.resource as DiagnosticReport);
                      }
                  }
              }
          }
      );

      this.requests = [];
      this.fhirService.getTIE('/ServiceRequest?patient=' + this.patientId + '').subscribe(bundle => {
          this._loadingService.resolve('overlayStarSyntax');
          if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                  if (entry.resource !== undefined && entry.resource.resourceType === 'ServiceRequest') { this.requests.push(entry.resource as ServiceRequest); }
              }
          }
      });

      this.procedures = [];
      this.fhirService.get('/Procedure?patient=' + this.patientId + '&_count=50&_sort=-date').subscribe(bundle => {
              if (bundle.entry !== undefined) {
                  for (const entry of bundle.entry) {
                      if (entry.resource !== undefined && entry.resource.resourceType === 'Procedure') {
                          this.procedures.push(entry.resource as Procedure);
                      }
                  }
              }
          }
      );
      /*
      this.immunisations = [];
      this.fhirService.get('/Immunization?patient=' + this.patientId ).subscribe(bundle => {
              if (bundle.entry !== undefined) {
                  for (const entry of bundle.entry) {
                      if (entry.resource !== undefined && entry.resource.resourceType === 'Immunization') {
                          this.immunisations.push(entry.resource as Immunization);
                      }
                  }
              }
          }
      );*/

      this.fhirService.getResource('/Patient/' + this.patientId)
          .subscribe(resource => {
                const patient = resource as Patient;
                if (patient !== undefined ) {
                  if (patient.identifier !== undefined){
                    for (const identifier of patient.identifier) {
                      if (identifier.system !== undefined && identifier.system.includes('nhs-number')) {
                        this.nhsNumber = identifier.value;
                      }
                    }
                  }
                }
              }
          );

    }
    clearDown(): void {
        this.encounters = [];
        this.patient = undefined;
        this.allergies = [];
        this.medicationRequests = [];
        this.conditions = [];
    }





  doStravaSetup(authorisationCode: string): void  {

 //   console.log(authorisationCode);

    // Subscribe to the token change
    this.strava.tokenChange.subscribe(
      () => {
        this.router.navigateByUrl('/patient/' + this.patientId);
      }
    );
    // this will emit a change when the token is retrieved
    this.strava.getOAuth2AccessToken(authorisationCode);
  }

  doWithingsSetup(authorisationCode: string, state: any): void {

  //  console.log(authorisationCode);
    this.withings.tokenChange.subscribe(
      () => {
        this.router.navigateByUrl('/patient/' + this.patientId);
      }
    );
    const url = window.location.href.split('?');
    this.withings.getOAuth2AccessToken(authorisationCode, url[0]);
  }
  stravaLoad(): void {
    this.getAthlete();

    this.phrLoad(false);
  }

  getAthlete(): void {

    this.strava.getAthlete().subscribe(
      result => {
        this.athlete = result;
        this.strava.setAthlete(result);
      },
      (err) => {
        console.log(err);
        if (err.status === 401) {
          this.stravaConnect = true;
        }
      }
    );
  }

  phrLoad(withing: boolean): void {
    this.stravaComplete = false;

    this.strava.getActivities();


   // TODO reload data
  }


  private async withingsLoad(): Promise<void> {
    // Process sequentially. Don't bombard AWS with many requests
    this.withings.getSleep();
    await delay(20000);
    await this.withings.getMeasures();
    await delay(100000);
    this.withings.getActivity();

    // Strava covers this this.withings.getWorkoutResults();
  }

    protected readonly undefined = undefined;

    addMedication() {
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
        const dialogRef = this.dialog.open( MedicationRequestCreateEditComponent, dialogConfig);
        dialogRef.afterClosed().subscribe(result => {

            if (result !== undefined && result.resourceType !== undefined) {
              //  console.log(result)
                this.medicationRequests.push(result);
                this.medicationRequests = Object.assign([], this.medicationRequests)
            }
        })
    }

    protected readonly environment = environment;
}
