import {Component, Inject, Input, OnInit, ViewContainerRef} from '@angular/core';

import {ActivatedRoute} from '@angular/router';
import { TdDialogService} from '@covalent/core/dialogs';
import {Binary, Bundle, Composition, DocumentReference, FhirResource, Patient} from "fhir/r4";
import {EprService} from "../../../services/epr.service";
import {FhirService} from "../../../services/fhir.service";
import {Fhir} from "fhir";

@Component({
  selector: 'app-binary',
  templateUrl: './binary.component.html',
  styleUrls: ['./binary.component.css']
})
export class BinaryComponent implements OnInit {


  binary: Binary | undefined;
  document: DocumentReference | undefined;

  public docType: string | undefined;

  pdfSrc: string = '';

  html: string = '';

  json: any;

  image: string |undefined

  page = 1;
  totalPages: number | undefined;
  isLoaded = false;
  patientId: string = '';
  private docid: string | undefined = undefined;

  constructor(
              private _dialogService: TdDialogService,
              private _viewContainerRef: ViewContainerRef,
              public fhirService: FhirService,
              private eprService: EprService,
              private route: ActivatedRoute) {
  }

  nextPage() {
    this.page++;
  }

  prevPage() {
    this.page--;
  }
  afterLoadComplete(pdfData: any) {
    console.log('PDF loaded');
    console.log(pdfData.numPages);
    this.totalPages = pdfData.numPages;
    this.isLoaded = true;
  }


  ngOnInit() {
    const docid= this.route.snapshot.paramMap.get('docid');
    if (docid != null) {
      this.docid = docid;
      this.getRecords()
    }
    let patient = this.eprService.getPatient()
    if (patient !== undefined) {
      if (patient.id !== undefined) {
        this.patientId = patient.id
      }
    }
    this.eprService.patientChangeEvent.subscribe(patient => {
      if (patient.id !== undefined) this.patientId = patient.id
    });
  }

  private getRecords() {
    this.fhirService.getResource('/DocumentReference/'+this.docid).subscribe(documentReference => {
          if (documentReference !== undefined) {
            this.document = documentReference;
            if (documentReference.content !== undefined && documentReference.content.length > 0 && documentReference.content[0].attachment !== undefined
                && documentReference.content[0].attachment.url !== undefined) {

              this.fhirService.getBinary("fhir/r4/"+documentReference.content[0].attachment.url).subscribe(result => {
                this.binary = result;
                this.processBinary();
              })
            }
          }
        }
    );
  }
  processBinary() {
    console.log('processBinary')
      if (this.binary !== undefined && this.document !== undefined) {
      if (this.binary.contentType === 'application/fhir+xml'
          || this.binary.contentType === 'text/xml'
          || this.binary.contentType === 'text/plain'
      //    || this.binary.contentType === 'application/fhir+json'

      ) {
        console.log('Is XML or JSON, assume FHIR')
        if (typeof this.binary.data === "string") {
          var xml = atob(this.binary.data);
          var jsonString: string;
          if (this.binary.contentType !== 'text/plain') {
            // FHIR xml to json doesn't like comments https://stackoverflow.com/questions/5653207/remove-html-comments-with-regex-in-javascript
            var COMMENT_PSEUDO_COMMENT_OR_LT_BANG = new RegExp(
                '<!--[\\s\\S]*?(?:-->)?'
                + '<!---+>?'  // A comment with no body
                + '|<!(?![dD][oO][cC][tT][yY][pP][eE]|\\[CDATA\\[)[^>]*>?'
                + '|<[?][^>]*>?',  // A pseudo-comment
                'g');
            xml = xml.replace(COMMENT_PSEUDO_COMMENT_OR_LT_BANG, "")
            var fhir = new Fhir();
            jsonString = fhir.xmlToJson(xml);
          } else {
            jsonString = xml
          }
          var document = JSON.parse(jsonString)
          if (document.resourceType === 'Bundle') {
             const bundle = document as Bundle;
             var html = '';
             let resource = this.getResource(bundle,'Patient')
             if (resource !== undefined) {
               const patient = resource as Patient
               if (patient.text !== undefined) html += patient.text.div
             }
             resource = this.getResource(bundle,'Composition')
             if (resource !== undefined) {
                 var composition = resource as Composition
                if (composition.text !== undefined) html += composition.text.div
                 if (composition.section !== undefined) {
                   // possibly swap back to this? https://github.com/nhsconnect/careconnect-document-viewer/blob/master/web/src/app/component/binary/composition-view-section/view-document-section.component.html
                   composition.section.forEach(section => {
                     if (section.title !== undefined) {
                        html += '<h3>'+ section.title + '</h3>'
                     }
                     if (section.text !== undefined && section.text.div !== undefined) {
                       html += section.text.div
                     }
                   })
                 }
                // console.log(html)
                 this.docType = 'html'
                 this.html = html
                 this.json = bundle
               }
             }

          }
        //this.docType = 'fhir';
      } else if (this.binary.contentType === 'application/pdf') {
          console.log('Is PDF')
          if (typeof this.binary.data === "string") {
              const blob = this.base64toBlob(this.binary.data, this.binary.contentType);
              /*
              const byteCharacters = atob(this.binary.data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], {type: this.binary.contentType});

              console.log(this.binary.contentType)
               */
              const blobUrl = URL.createObjectURL(blob);
              //window.open(blobUrl, '_blank');
              this.pdfSrc = blobUrl
              console.log(this.pdfSrc)
          }

       // if (this.document.content[0].attachment.url !== undefined) this.pdfSrc = blob
        this.docType = 'pdf';
        this.isLoaded = true;
      }
      else if (this.binary.contentType.indexOf('html') !== -1) {
        this.docType = 'html';
        if (typeof this.binary.data === "string") {
          this.html = atob(this.binary.data);
        }
      }
      else if (this.binary.contentType.indexOf('image') !== -1) {
        console.log(this.document.content[0].attachment.url)
        this.image = this.document.content[0].attachment.url
        this.docType = 'image';
      }
    }
  }

  getXML(resource: FhirResource) {
    var fhir = new Fhir();
    return this.formatXml(fhir.jsonToXml(JSON.stringify(resource)));
  }



  formatXml(xml: string, tab?: string) { // tab = optional indent value, default is tab (\t)
    var formatted = '', indent= '';
    if (tab === undefined) tab = '\t';
    xml.split(/>\s*</).forEach(function(node) {
      if (node.match( /^\/\w/ )) { // @ts-ignore
        indent = indent.substring(tab.length);
      } // decrease indent by one 'tab'
      formatted += indent + '<' + node + '>\r\n';
      if (node.match( /^<?\w[^>]*[^\/]$/ )) indent += tab;              // increase indent
    });
    return formatted.substring(1, formatted.length-3);
  }

  getResource(bundle : Bundle, type: string): FhirResource | undefined {
    if (bundle.entry !== undefined) {
      for (let entry of bundle.entry) {
        if (entry.resource !== undefined && entry.resource.resourceType === type) return entry.resource;
      }
    }
    return undefined
  }

    private base64toBlob(base64Data: string, contentType: string): Blob {
        contentType = contentType || '';
        const sliceSize = 1024;
        const byteCharacters = atob(base64Data);
        const bytesLength = byteCharacters.length;
        const slicesCount = Math.ceil(bytesLength / sliceSize);
        const byteArrays = new Array(slicesCount);

        for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
            const begin = sliceIndex * sliceSize;
            const end = Math.min(begin + sliceSize, bytesLength);

            const bytes = new Array(end - begin);
            for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
                bytes[i] = byteCharacters[offset].charCodeAt(0);
            }
            byteArrays[sliceIndex] = new Uint8Array(bytes);
        }
        return new Blob(byteArrays, { type: contentType });
    }

  protected readonly JSON = JSON;

}
