package com.labguard.repository;

import com.labguard.entity.EnrollmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EnrollmentRequestRepository extends JpaRepository<EnrollmentRequest, UUID> {

    List<EnrollmentRequest> findByStatusOrderByCreatedAtDesc(String status);

    @Query("SELECT er FROM EnrollmentRequest er WHERE er.faculty.user.id = :facultyUserId ORDER BY er.createdAt DESC")
    List<EnrollmentRequest> findByFacultyUserId(@Param("facultyUserId") UUID facultyUserId);

    List<EnrollmentRequest> findAllByOrderByCreatedAtDesc();
}
