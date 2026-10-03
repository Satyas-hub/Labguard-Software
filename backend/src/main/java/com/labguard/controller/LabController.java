package com.labguard.controller;

import com.labguard.dto.LabDtos.*;
import com.labguard.dto.SessionDtos.LabActivityItemDto;
import com.labguard.dto.SessionDtos.LabOccupancyDto;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.LabService;
import com.labguard.service.SessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/labs")
@RequiredArgsConstructor
public class LabController {

    private final LabService labService;
    private final SessionService sessionService;
    private final UserRepository userRepository;

    /**
     * Lists labs available to the requester (Admin sees all, Faculty/Assistant see assigned)
     */
    @GetMapping
    public ResponseEntity<List<LabSummaryDto>> getLabs(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        List<LabSummaryDto> labs = labService.getAssignedLabsForUser(user.getId());
        return ResponseEntity.ok(labs);
    }

    /**
     * Strict RBAC: Faculty or Assistant accessing unassigned lab returns 403 Forbidden!
     */
    @GetMapping("/{labId}")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<LabSummaryDto> getLabDetail(@PathVariable UUID labId) {
        LabSummaryDto lab = labService.getLabSummaryById(labId);
        return ResponseEntity.ok(lab);
    }

    @GetMapping("/code/{labCode}")
    @PreAuthorize("@labSecurity.hasLabCodeAccess(authentication, #labCode)")
    public ResponseEntity<LabSummaryDto> getLabByCode(@PathVariable String labCode) {
        LabSummaryDto lab = labService.getLabSummaryByCode(labCode);
        return ResponseEntity.ok(lab);
    }

    @GetMapping("/{labId}/occupancy")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<LabOccupancyDto> getLabOccupancy(@PathVariable UUID labId) {
        LabOccupancyDto occupancy = sessionService.getLabOccupancy(labId);
        return ResponseEntity.ok(occupancy);
    }

    @GetMapping("/{labId}/who-is-in")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<LabActivityItemDto>> getWhoIsInTheLab(@PathVariable UUID labId) {
        List<LabActivityItemDto> list = sessionService.getWhoIsInTheLab(labId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{labId}/who-left")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<LabActivityItemDto>> getWhoLeftTheLab(@PathVariable UUID labId) {
        List<LabActivityItemDto> list = sessionService.getWhoLeftTheLab(labId);
        return ResponseEntity.ok(list);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LabSummaryDto> createLab(
        @Valid @RequestBody CreateLabRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        LabSummaryDto created = labService.createLab(request, admin);
        return ResponseEntity.ok(created);
    }

    @PostMapping("/assign-staff")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> assignStaff(
        @Valid @RequestBody AssignStaffRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        labService.assignStaffToLab(request, admin);
        return ResponseEntity.ok().build();
    }
}
