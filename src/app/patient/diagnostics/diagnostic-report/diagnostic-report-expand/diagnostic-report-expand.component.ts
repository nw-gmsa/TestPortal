import {Component, Input, OnInit} from '@angular/core';
import {DiagnosticReport, Observation} from "fhir/r4";
import {FhirService} from "../../../../services/fhir.service";
import {TdLoadingService} from "@covalent/core/loading";

@Component({
  selector: 'app-diagnostic-report-expand',
  templateUrl: './diagnostic-report-expand.component.html',
  styleUrl: './diagnostic-report-expand.component.scss'
})

export class DiagnosticReportExpandComponent implements OnInit {

  @Input() diagnosticReport: DiagnosticReport | undefined

  constructor( public fhirService: FhirService,
               private _loadingService: TdLoadingService) {
  }

  observations: Observation[] | undefined;

  ngOnInit() {

    if (this.diagnosticReport?.id !== undefined) {
      var obs :Observation[] = [];
      if (this.diagnosticReport?.result !== undefined) {
        for (const result of this.diagnosticReport?.result) {
          if (result.reference !== undefined) {
            this.fhirService.getResource('/'+result.reference)
                .subscribe(resource => {
                    if (resource.resourceType === 'Observation') {
                      obs.push(resource as Observation);
                    //  console.log(resource)
                    }
                    if (this.diagnosticReport?.result?.length == obs.length) {
                      this.observations = obs;
                    }
                },() => {}, () =>{
                  this._loadingService.resolve('overlayStarSyntax');
                }
                )
          }
        }
      }
      /*
      this.fhirService.get('/DiagnosticReport?_id=' + this.diagnosticReport?.id
          + '&_include=DiagnosticReport:result')
          .subscribe(bundle => {
            if (bundle.entry !== undefined) {
              for (const entry of bundle.entry) {
                if (entry.resource !== undefined && entry.resource.resourceType === 'Observation') {
                  obs.push(entry.resource as Observation);
                  console.log(entry.resource)
                }
              }
              this.observations = obs;
            }
          },() => {}, () =>{
            this._loadingService.resolve('overlayStarSyntax');
          }
      );*/
    }
  }
}
